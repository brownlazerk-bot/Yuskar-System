import { Order } from '../types';
import { formatCurrency } from './currency';

export interface DepartmentalSalesBreakdown {
  name: string;
  code: string;
  totalSales: number;
  paidSales: number;
  pendingSales: number;
  itemsCount: number;
  cashAmount: number;
  momoAmount: number;
  cardAmount: number;
  creditAmount: number;
  roomChargeAmount: number;
}

export interface DepartmentalSalesSummary {
  date: string;
  bar: DepartmentalSalesBreakdown;
  kitchen: DepartmentalSalesBreakdown;
  pool: DepartmentalSalesBreakdown;
  sauna: DepartmentalSalesBreakdown;
  rooms: DepartmentalSalesBreakdown;
  totalRevenue: number;
  totalPaidRevenue: number;
  totalPendingRevenue: number;
  totalOrdersCount: number;
  paymentTotals: {
    cash: number;
    momo: number;
    card: number;
    credit: number;
    roomCharge: number;
  };
}

/**
 * Flexible Date Matcher for Orders
 */
export function matchesOrderDate(order: Order, targetDateStr: string): boolean {
  if (!targetDateStr) return true;
  if (order.status === 'Cancelled') return false;

  const datesToCheck = [order.createdAt, order.paidAt, order.updatedAt].filter(Boolean) as string[];
  
  for (const dStr of datesToCheck) {
    if (dStr.startsWith(targetDateStr)) return true;
    try {
      const localDateIso = new Date(dStr).toLocaleDateString('sv'); // 'YYYY-MM-DD'
      if (localDateIso === targetDateStr) return true;
    } catch (e) {}
  }
  
  if (order.businessDate) {
    if (order.businessDate.startsWith(targetDateStr)) return true;
    try {
      const targetFormatted = new Date(targetDateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      if (order.businessDate === targetFormatted || order.businessDate.includes(targetDateStr)) return true;
    } catch (e) {}
  }
  return false;
}

/**
 * Determines whether an order is considered paid
 */
export function isOrderPaid(o: Order): boolean {
  if (o.status === 'Cancelled') return false;
  if (o.paymentStatus === 'PAID' || o.status === 'Paid') return true;
  if ((o.status === 'Served' || (o.status as string) === 'Completed') && (o.balance <= 0.01 || (o.amountPaid && o.amountPaid >= o.total))) return true;
  if (o.amountPaid && o.amountPaid >= o.total && o.total > 0) return true;
  return false;
}

/**
 * Calculates accurate departmental sales and submission amounts for a given target date
 */
export function calculateDepartmentalSales(orders: Order[] = [], targetDate: string): DepartmentalSalesSummary {
  const dateOrders = orders.filter(o => matchesOrderDate(o, targetDate));

  const createDept = (name: string, code: string): DepartmentalSalesBreakdown => ({
    name,
    code,
    totalSales: 0,
    paidSales: 0,
    pendingSales: 0,
    itemsCount: 0,
    cashAmount: 0,
    momoAmount: 0,
    cardAmount: 0,
    creditAmount: 0,
    roomChargeAmount: 0
  });

  const bar = createDept('Bar & Beverages', 'BAR');
  const kitchen = createDept('Kitchen & Restaurant', 'KIT');
  const pool = createDept('Swimming Pool', 'POL');
  const sauna = createDept('Sauna & Steam', 'SAU');
  const rooms = createDept('Rooms & Accommodation', 'ROM');

  const paymentTotals = {
    cash: 0,
    momo: 0,
    card: 0,
    credit: 0,
    roomCharge: 0
  };

  dateOrders.forEach((order) => {
    const isPaid = isOrderPaid(order);
    const isCredit = order.paymentStatus === 'CREDIT' || order.status === 'Credit';
    const payMethod = order.paymentMethod || 'Cash';

    // Track total order level payment distributions
    if (isPaid) {
      if (payMethod === 'Cash') paymentTotals.cash += order.total;
      else if (payMethod === 'Mobile Money') paymentTotals.momo += order.total;
      else if (payMethod === 'Card') paymentTotals.card += order.total;
      else if (payMethod === 'Room Charge' || payMethod === 'Apartment Charge') paymentTotals.roomCharge += order.total;
      else if (payMethod === 'Mixed' && order.paymentDetails) {
        paymentTotals.cash += order.paymentDetails.cashPaid || 0;
        paymentTotals.momo += order.paymentDetails.mobileMoneyPaid || 0;
        paymentTotals.card += order.paymentDetails.cardPaid || 0;
      }
    } else if (isCredit) {
      paymentTotals.credit += (order.balance > 0 ? order.balance : order.total - (order.amountPaid || 0));
    }

    // Check if whole order is Room Booking / Accommodation
    const isRoomOrder = 
      order.servicesIncluded?.includes('Rooms') || 
      order.servicesIncluded?.includes('Apartments') ||
      payMethod === 'Room Charge' || 
      payMethod === 'Apartment Charge' ||
      (order.items && order.items.length === 0 && order.total > 0);

    if (isRoomOrder && (!order.items || order.items.length === 0)) {
      rooms.totalSales += order.total;
      if (isPaid) {
        rooms.paidSales += order.total;
        if (payMethod === 'Cash') rooms.cashAmount += order.total;
        else if (payMethod === 'Mobile Money') rooms.momoAmount += order.total;
        else if (payMethod === 'Card') rooms.cardAmount += order.total;
        else rooms.roomChargeAmount += order.total;
      } else {
        rooms.pendingSales += order.total;
        if (isCredit) rooms.creditAmount += order.total;
      }
      rooms.itemsCount += 1;
      return;
    }

    // Break down order items into respective departments
    if (order.items && order.items.length > 0) {
      order.items.forEach((item) => {
        const itemTotal = item.totalPrice || ((item.price || 0) * (item.quantity || 1));
        const itemQty = item.quantity || 1;
        const cat = (item.category || '').trim().toLowerCase();
        const itemName = (item.name || '').toLowerCase();

        let dept = bar;

        if (
          cat === 'food' || 
          item.isFood || 
          cat.includes('kitchen') || 
          cat.includes('snack') || 
          cat.includes('pizza') || 
          cat.includes('burger') || 
          cat.includes('breakfast') || 
          cat.includes('lunch') || 
          cat.includes('dinner') || 
          cat.includes('meat') || 
          cat.includes('fish') || 
          cat.includes('soup') || 
          cat.includes('dessert') ||
          itemName.includes('brochette') ||
          itemName.includes('chicken') ||
          itemName.includes('chips') ||
          itemName.includes('fries') ||
          itemName.includes('salad')
        ) {
          dept = kitchen;
        } else if (
          cat.includes('pool') || 
          cat.includes('swimming') || 
          itemName.includes('pool') || 
          itemName.includes('swimming')
        ) {
          dept = pool;
        } else if (
          cat.includes('sauna') || 
          cat.includes('steam') || 
          cat.includes('massage') || 
          cat.includes('wellness') || 
          itemName.includes('sauna') || 
          itemName.includes('steam') || 
          itemName.includes('massage')
        ) {
          dept = sauna;
        } else if (
          cat.includes('room') || 
          cat.includes('accommodation') || 
          cat.includes('apartment') || 
          itemName.includes('room') || 
          itemName.includes('stay') || 
          itemName.includes('night')
        ) {
          dept = rooms;
        } else {
          // Defaults to Bar (Beverages, Beers, Wines, Liquors, Soft Drinks, Juices, Water, etc.)
          dept = bar;
        }

        dept.totalSales += itemTotal;
        dept.itemsCount += itemQty;

        if (isPaid) {
          dept.paidSales += itemTotal;
          if (payMethod === 'Cash') dept.cashAmount += itemTotal;
          else if (payMethod === 'Mobile Money') dept.momoAmount += itemTotal;
          else if (payMethod === 'Card') dept.cardAmount += itemTotal;
          else if (payMethod === 'Room Charge' || payMethod === 'Apartment Charge') dept.roomChargeAmount += itemTotal;
          else if (payMethod === 'Mixed' && order.paymentDetails) {
            // Proportional split for mixed
            const orderSub = order.total || 1;
            const ratio = itemTotal / orderSub;
            dept.cashAmount += (order.paymentDetails.cashPaid || 0) * ratio;
            dept.momoAmount += (order.paymentDetails.mobileMoneyPaid || 0) * ratio;
            dept.cardAmount += (order.paymentDetails.cardPaid || 0) * ratio;
          } else {
            dept.cashAmount += itemTotal;
          }
        } else {
          dept.pendingSales += itemTotal;
          if (isCredit) {
            dept.creditAmount += itemTotal;
          }
        }
      });
    } else if (order.total > 0) {
      // Unspecified item list fallback to Bar
      bar.totalSales += order.total;
      bar.itemsCount += 1;
      if (isPaid) {
        bar.paidSales += order.total;
        if (payMethod === 'Cash') bar.cashAmount += order.total;
        else if (payMethod === 'Mobile Money') bar.momoAmount += order.total;
        else if (payMethod === 'Card') bar.cardAmount += order.total;
      } else {
        bar.pendingSales += order.total;
        if (isCredit) bar.creditAmount += order.total;
      }
    }
  });

  const totalRevenue = bar.totalSales + kitchen.totalSales + pool.totalSales + sauna.totalSales + rooms.totalSales;
  const totalPaidRevenue = bar.paidSales + kitchen.paidSales + pool.paidSales + sauna.paidSales + rooms.paidSales;
  const totalPendingRevenue = bar.pendingSales + kitchen.pendingSales + pool.pendingSales + sauna.pendingSales + rooms.pendingSales;

  return {
    date: targetDate,
    bar,
    kitchen,
    pool,
    sauna,
    rooms,
    totalRevenue,
    totalPaidRevenue,
    totalPendingRevenue,
    totalOrdersCount: dateOrders.length,
    paymentTotals
  };
}

/**
 * Formats HTML Departmental Submission Summary for Receipt and A4 Printouts
 */
export function generateDepartmentalSummaryHTML(
  summary: DepartmentalSalesSummary,
  isThermal: boolean = false
): string {
  if (isThermal) {
    return `
      <div style="border-top: 2px dashed #000; border-bottom: 2px dashed #000; margin: 8px 0; padding: 6px 0; font-family: monospace;">
        <div style="text-align: center; font-weight: 900; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">
          === DEPARTMENTAL SALES TO SUBMIT ===
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin: 2px 0;">
          <span>1. BAR SALES:</span>
          <span>RWF ${summary.bar.totalSales.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8px; color: #444; margin-bottom: 2px;">
          <span>   (Paid: ${summary.bar.paidSales.toLocaleString()} | Open: ${summary.bar.pendingSales.toLocaleString()})</span>
          <span>${summary.bar.itemsCount} drinks</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin: 2px 0;">
          <span>2. KITCHEN SALES:</span>
          <span>RWF ${summary.kitchen.totalSales.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8px; color: #444; margin-bottom: 2px;">
          <span>   (Paid: ${summary.kitchen.paidSales.toLocaleString()} | Open: ${summary.kitchen.pendingSales.toLocaleString()})</span>
          <span>${summary.kitchen.itemsCount} dishes</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin: 2px 0;">
          <span>3. POOL SALES:</span>
          <span>RWF ${summary.pool.totalSales.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8px; color: #444; margin-bottom: 2px;">
          <span>   (Paid: ${summary.pool.paidSales.toLocaleString()})</span>
          <span>${summary.pool.itemsCount} entries</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin: 2px 0;">
          <span>4. SAUNA SALES:</span>
          <span>RWF ${summary.sauna.totalSales.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8px; color: #444; margin-bottom: 2px;">
          <span>   (Paid: ${summary.sauna.paidSales.toLocaleString()})</span>
          <span>${summary.sauna.itemsCount} sessions</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin: 2px 0;">
          <span>5. ROOM / ACCOMM:</span>
          <span>RWF ${summary.rooms.totalSales.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8px; color: #444; margin-bottom: 4px;">
          <span>   (Paid: ${summary.rooms.paidSales.toLocaleString()} | Open: ${summary.rooms.pendingSales.toLocaleString()})</span>
          <span>${summary.rooms.itemsCount} bookings</span>
        </div>

        <div style="border-top: 1px solid #000; padding-top: 4px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 900;">
          <span>TOTAL RESORT REVENUE:</span>
          <span>RWF ${summary.totalRevenue.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; color: #000; margin-top: 2px;">
          <span>TOTAL PAID CASH & MOMO:</span>
          <span>RWF ${summary.totalPaidRevenue.toLocaleString()}</span>
        </div>
        ${summary.totalPendingRevenue > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #d97706; font-weight: bold;">
          <span>TOTAL PENDING / UNCOLLECTED:</span>
          <span>RWF ${summary.totalPendingRevenue.toLocaleString()}</span>
        </div>
        ` : ''}

        <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 8px;">
          <div style="font-weight: bold; margin-bottom: 2px;">COLLECTIONS BREAKDOWN:</div>
          <div style="display: flex; justify-content: space-between;">
            <span>Cash Collected:</span> <span>RWF ${summary.paymentTotals.cash.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Mobile Money (MoMo):</span> <span>RWF ${summary.paymentTotals.momo.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Card Payments:</span> <span>RWF ${summary.paymentTotals.card.toLocaleString()}</span>
          </div>
          ${summary.paymentTotals.credit > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #b91c1c;">
            <span>Credit / Outstanding:</span> <span>RWF ${summary.paymentTotals.credit.toLocaleString()}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Standard A4 Departmental Summary Table
  return `
    <div style="margin-top: 25px; border: 2px solid #1e293b; border-radius: 6px; padding: 15px; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 12px;">
        <div>
          <h3 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
            Departmental Sales & Revenue Submission Summary
          </h3>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">
            Official breakdown of sales by department to reconcile daily handover amounts.
          </p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 12px; font-weight: 900; background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 4px;">
            DATE: ${summary.date}
          </span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 8px 10px; text-align: left; font-weight: bold; color: #334155;">Department Section</th>
            <th style="padding: 8px 10px; text-align: center; font-weight: bold; color: #334155;">Volume / Qty</th>
            <th style="padding: 8px 10px; text-align: right; font-weight: bold; color: #059669;">Paid Sales (RWF)</th>
            <th style="padding: 8px 10px; text-align: right; font-weight: bold; color: #d97706;">Pending (RWF)</th>
            <th style="padding: 8px 10px; text-align: right; font-weight: 900; color: #0f172a;">Total Sales (RWF)</th>
            <th style="padding: 8px 10px; text-align: left; font-weight: bold; color: #334155;">Department Head Signature</th>
          </tr>
        </thead>
        <tbody>
          <!-- 1. Bar Sales -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">
              <span style="display: inline-block; width: 10px; height: 10px; background: #7c3aed; border-radius: 2px; margin-right: 6px;"></span>
              1. Bar & Beverage Department
            </td>
            <td style="padding: 8px 10px; text-align: center;">${summary.bar.itemsCount} drinks</td>
            <td style="padding: 8px 10px; text-align: right; color: #059669; font-weight: bold;">RWF ${summary.bar.paidSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; text-align: right; color: #d97706;">${summary.bar.pendingSales > 0 ? `RWF ${summary.bar.pendingSales.toLocaleString()}` : '-'}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 900; color: #1e293b;">RWF ${summary.bar.totalSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; color: #94a3b8; font-size: 10px;">___________________</td>
          </tr>

          <!-- 2. Kitchen Sales -->
          <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
            <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">
              <span style="display: inline-block; width: 10px; height: 10px; background: #ea580c; border-radius: 2px; margin-right: 6px;"></span>
              2. Kitchen & Restaurant Department
            </td>
            <td style="padding: 8px 10px; text-align: center;">${summary.kitchen.itemsCount} dishes</td>
            <td style="padding: 8px 10px; text-align: right; color: #059669; font-weight: bold;">RWF ${summary.kitchen.paidSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; text-align: right; color: #d97706;">${summary.kitchen.pendingSales > 0 ? `RWF ${summary.kitchen.pendingSales.toLocaleString()}` : '-'}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 900; color: #1e293b;">RWF ${summary.kitchen.totalSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; color: #94a3b8; font-size: 10px;">___________________</td>
          </tr>

          <!-- 3. Pool Sales -->
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">
              <span style="display: inline-block; width: 10px; height: 10px; background: #0284c7; border-radius: 2px; margin-right: 6px;"></span>
              3. Swimming Pool Department
            </td>
            <td style="padding: 8px 10px; text-align: center;">${summary.pool.itemsCount} entries</td>
            <td style="padding: 8px 10px; text-align: right; color: #059669; font-weight: bold;">RWF ${summary.pool.paidSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; text-align: right; color: #d97706;">${summary.pool.pendingSales > 0 ? `RWF ${summary.pool.pendingSales.toLocaleString()}` : '-'}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 900; color: #1e293b;">RWF ${summary.pool.totalSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; color: #94a3b8; font-size: 10px;">___________________</td>
          </tr>

          <!-- 4. Sauna Sales -->
          <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
            <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">
              <span style="display: inline-block; width: 10px; height: 10px; background: #e11d48; border-radius: 2px; margin-right: 6px;"></span>
              4. Sauna & Steam Wellness Department
            </td>
            <td style="padding: 8px 10px; text-align: center;">${summary.sauna.itemsCount} sessions</td>
            <td style="padding: 8px 10px; text-align: right; color: #059669; font-weight: bold;">RWF ${summary.sauna.paidSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; text-align: right; color: #d97706;">${summary.sauna.pendingSales > 0 ? `RWF ${summary.sauna.pendingSales.toLocaleString()}` : '-'}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 900; color: #1e293b;">RWF ${summary.sauna.totalSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; color: #94a3b8; font-size: 10px;">___________________</td>
          </tr>

          <!-- 5. Rooms Sales -->
          <tr style="border-bottom: 2px solid #cbd5e1;">
            <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">
              <span style="display: inline-block; width: 10px; height: 10px; background: #0d9488; border-radius: 2px; margin-right: 6px;"></span>
              5. Hotel Rooms & Accommodation
            </td>
            <td style="padding: 8px 10px; text-align: center;">${summary.rooms.itemsCount} bookings</td>
            <td style="padding: 8px 10px; text-align: right; color: #059669; font-weight: bold;">RWF ${summary.rooms.paidSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; text-align: right; color: #d97706;">${summary.rooms.pendingSales > 0 ? `RWF ${summary.rooms.pendingSales.toLocaleString()}` : '-'}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 900; color: #1e293b;">RWF ${summary.rooms.totalSales.toLocaleString()}</td>
            <td style="padding: 8px 10px; color: #94a3b8; font-size: 10px;">___________________</td>
          </tr>

          <!-- Grand Total Row -->
          <tr style="background: #e2e8f0; font-weight: 900; font-size: 12px;">
            <td style="padding: 10px; color: #0f172a; text-transform: uppercase;">
              TOTAL RESORT REVENUE TO SUBMIT:
            </td>
            <td style="padding: 10px; text-align: center;">${summary.bar.itemsCount + summary.kitchen.itemsCount + summary.pool.itemsCount + summary.sauna.itemsCount + summary.rooms.itemsCount} Total</td>
            <td style="padding: 10px; text-align: right; color: #059669; font-size: 13px;">RWF ${summary.totalPaidRevenue.toLocaleString()}</td>
            <td style="padding: 10px; text-align: right; color: #d97706;">RWF ${summary.totalPendingRevenue.toLocaleString()}</td>
            <td style="padding: 10px; text-align: right; color: #0f172a; font-size: 14px;">RWF ${summary.totalRevenue.toLocaleString()}</td>
            <td style="padding: 10px; color: #0f172a; font-size: 10px;">General Manager Sign: __________</td>
          </tr>
        </tbody>
      </table>

      <!-- Method Breakdown Cards in Print -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px;">
        <div>
          <span style="color: #64748b;">Cash Sales to Submit:</span><br/>
          <strong style="font-size: 12px; color: #059669;">RWF ${summary.paymentTotals.cash.toLocaleString()}</strong>
        </div>
        <div>
          <span style="color: #64748b;">Mobile Money (MoMo):</span><br/>
          <strong style="font-size: 12px; color: #0284c7;">RWF ${summary.paymentTotals.momo.toLocaleString()}</strong>
        </div>
        <div>
          <span style="color: #64748b;">POS Card Payments:</span><br/>
          <strong style="font-size: 12px; color: #7c3aed;">RWF ${summary.paymentTotals.card.toLocaleString()}</strong>
        </div>
        <div>
          <span style="color: #64748b;">Pending Credit Balance:</span><br/>
          <strong style="font-size: 12px; color: #d97706;">RWF ${summary.paymentTotals.credit.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  `;
}

import React, { useState } from 'react';
import { Plus, Trash2, Tag, Layers, Boxes, DollarSign, Barcode, Check } from 'lucide-react';
import { ProductVariant } from '../../types';
import { formatCurrency } from '../../lib/currency';

interface ProductVariantManagerProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  basePrice: number;
  baseCostPrice?: number;
  darkMode?: boolean;
}

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '36', '38', '40', '42', '44', '46'];
const COMMON_COLORS = ['Black', 'White', 'Navy Blue', 'Royal Blue', 'Red', 'Grey', 'Beige', 'Brown', 'Green', 'Yellow', 'Pink'];

export const ProductVariantManager: React.FC<ProductVariantManagerProps> = ({
  variants,
  onChange,
  basePrice,
  baseCostPrice = 0,
  darkMode = false
}) => {
  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newPrice, setNewPrice] = useState(basePrice ? String(basePrice) : '');
  const [newSku, setNewSku] = useState('');

  const handleAddVariant = () => {
    if (!newSize.trim() && !newColor.trim()) return;

    const variant: ProductVariant = {
      id: crypto.randomUUID(),
      productId: '',
      size: newSize.trim() || undefined,
      color: newColor.trim() || undefined,
      sku: newSku.trim() || undefined,
      stockQuantity: Number(newStock) || 0,
      price: newPrice ? Number(newPrice) : basePrice,
      costPrice: baseCostPrice,
      minStockAlert: 3
    };

    onChange([...variants, variant]);
    setNewSize('');
    setNewColor('');
    setNewSku('');
  };

  const handleRemoveVariant = (id: string) => {
    onChange(variants.filter(v => v.id !== id));
  };

  const handleUpdateStock = (id: string, newQty: number) => {
    onChange(variants.map(v => v.id === id ? { ...v, stockQuantity: Math.max(0, newQty) } : v));
  };

  const handleUpdatePrice = (id: string, priceVal: number) => {
    onChange(variants.map(v => v.id === id ? { ...v, price: Math.max(0, priceVal) } : v));
  };

  return (
    <div className={`p-4 rounded-xl border space-y-4 ${
      darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Product Variants (Sizes, Colors & Stock)
          </span>
        </div>
        <span className="text-xs text-slate-400">
          {variants.length} active variants
        </span>
      </div>

      {/* Quick Add Form */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Size / Dimensions
          </label>
          <input
            type="text"
            list="common-sizes"
            value={newSize}
            onChange={e => setNewSize(e.target.value)}
            placeholder="e.g. XL or 42"
            className={`w-full px-3 py-1.5 rounded-lg border text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
            }`}
          />
          <datalist id="common-sizes">
            {COMMON_SIZES.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Color / Shade
          </label>
          <input
            type="text"
            list="common-colors"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            placeholder="e.g. Navy Blue"
            className={`w-full px-3 py-1.5 rounded-lg border text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
            }`}
          />
          <datalist id="common-colors">
            {COMMON_COLORS.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Initial Stock
          </label>
          <input
            type="number"
            value={newStock}
            onChange={e => setNewStock(e.target.value)}
            placeholder="10"
            className={`w-full px-3 py-1.5 rounded-lg border text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
            }`}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Variant Price (RWF)
          </label>
          <input
            type="number"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            placeholder={String(basePrice || 0)}
            className={`w-full px-3 py-1.5 rounded-lg border text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
            }`}
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleAddVariant}
            className="w-full py-1.5 px-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Variant
          </button>
        </div>
      </div>

      {/* Variants List Table */}
      {variants.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-700/40 max-h-48 overflow-y-auto pr-1">
          {variants.map(v => (
            <div
              key={v.id}
              className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {v.size && (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold text-[11px]">
                    Size: {v.size}
                  </span>
                )}
                {v.color && (
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[11px]">
                    Color: {v.color}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Stock:</span>
                  <input
                    type="number"
                    value={v.stockQuantity}
                    onChange={e => handleUpdateStock(v.id, Number(e.target.value))}
                    className="w-14 px-1.5 py-0.5 rounded border text-xs text-right"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">Price:</span>
                  <input
                    type="number"
                    value={v.price || basePrice}
                    onChange={e => handleUpdatePrice(v.id, Number(e.target.value))}
                    className="w-20 px-1.5 py-0.5 rounded border text-xs text-right"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveVariant(v.id)}
                  className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

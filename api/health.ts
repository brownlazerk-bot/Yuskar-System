type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (data: any) => ApiResponse;
};

export default function handler(req: ApiRequest, res: ApiResponse) {
  return res.status(200).json({
    status: 'ok',
    environment: 'vercel-serverless',
    time: new Date().toISOString()
  });
}

# 支付后端（Native 扫码）

此服务用于 EXE 端展示微信扫码支付二维码（`trade_type=NATIVE`），并接收微信支付回调后给用户充值积分。

## 启动

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

## 接口

- `POST /api/recharge/native/create`
  - body: `{ "userId": "xxx", "packageId": "pkg_2000" }`
  - resp: `{ orderId, codeUrl, points, amountFen }`
- `GET /api/recharge/native/status?orderId=...`
  - resp: `{ status, tradeState }`
- `POST /api/wechatpay/notify`
  - 微信支付 V3 回调地址（需要公网可访问）

## 套餐配置

当前固定四档（分单位）：

- `pkg_500`：500 积分，¥9.90
- `pkg_2000`：2000 积分，¥29.90
- `pkg_5000`：5000 积分，¥69.90
- `pkg_12000`：12000 积分，¥159.90


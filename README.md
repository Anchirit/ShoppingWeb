# 个人信息

姓名：丘俊彬
学号：202330451491

# 丘先生的杂货铺

带真实 Node/Express + MongoDB 后端的电商演示站点，包含前台购物与销售后台。

## 可直接访问网址

anchirit.com

## 运行方式

### Docker Compose（推荐）

```bash
docker compose up
```

打开 `http://localhost:5000`。

### 本地 Node（可选）

1. `cd backend`
2. `copy .env.example .env` 并填写配置
3. `npm install`
4. `npm run seed`（可选，写入演示账号和商品）
5. `npm run dev`

## 代码结构

```
.
├── backend/                 # 后端服务
│   ├── config/              # 数据库连接
│   ├── controllers/         # 业务逻辑
│   ├── middleware/          # 鉴权/错误处理
│   ├── models/              # Mongoose 模型
│   ├── routes/              # API 路由
│   ├── utils/               # 邮件/异步工具
│   ├── uploads/             # 上传图片存放（运行时自动生成）
│   ├── .env.example         # 环境变量示例
│   ├── package.json         # 依赖与脚本
│   ├── seed.js              # 初始化数据
│   └── server.js            # 入口
├── public/                  # 前端静态资源
│   ├── app.js               # 前端业务逻辑与交互
│   ├── index.html           # 页面结构
│   └── styles.css           # 样式、动画与响应式布局
├── docker-compose.yml       # 容器编排
├── README.md                # 使用说明
└── 项目介绍.md              # 设计/功能完整介绍
```

## 代码说明

- `backend/server.js`：服务入口，注册 API/静态资源/缓存策略。
- `backend/controllers/`：购物、订单、支付、邮箱验证等核心业务逻辑。
- `backend/models/`：用户、商品、订单的数据模型定义。
- `backend/routes/`：REST API 路由层。
- `public/app.js`：前端交互与页面渲染逻辑。
- `public/styles.css`：设计系统、动画与响应式样式。

## 演示账号（已 seed）

- 销售：`sales@qiu.store` / `sales123`
- 顾客：`customer@qiu.store` / `customer123`

## 关键配置

- `SALES_REGISTRATION_CODE`：销售账号注册邀请码（为空则禁止注册销售账号）
- `STRIPE_SECRET_KEY`：Stripe 沙箱密钥（为空则走本地模拟）
- `MONGO_URI`：MongoDB 连接地址
- `SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM`：启用真实邮件发送（QQ 邮箱请用授权码）

## 邮件发送（QQ 邮箱示例）

```
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=1902432212@qq.com
SMTP_PASS=你的QQ邮箱授权码
SMTP_FROM=1902432212@qq.com
```

说明：邮箱格式无效时会跳过发送并给出提示。

## 说明

- 邮件未配置 SMTP 时会输出到服务端日志。
- 前端静态资源来自 `public/` 目录。
- 注册后需要完成邮箱验证码验证，未验证将不会发送订单/收货邮件。

# 项目说明

本项目依赖环境如下：
- Node 版本：**24**
- 包管理器：使用 **npm**

## Docker 构建与运行

你可以通过 Docker 构建并运行本项目，命令如下：

```bash
# 构建镜像
docker build -t jike .

# 运行容器
docker run -d -p 3004:3004 --name jike jike:latest
```

> 请确保本地 Node 版本为 24，并使用 npm 进行依赖管理。

---

## 线上访问地址

- 项目部署地址：[https://jike-165954-5-1362504576.sh.run.tcloudbase.com/#/home](https://jike-165954-5-1362504576.sh.run.tcloudbase.com/#/home)

# 玲钰记账

一个无需后端即可运行的个人账单管家小程序原型。

## 运行

在当前目录执行：

```bash
node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((req,res)=>{const file=path.join(process.cwd(),req.url==='/'?'index.html':req.url);fs.readFile(file,(e,d)=>{if(e){res.statusCode=404;res.end('Not found')}else{res.end(d)}})}).listen(4173,()=>console.log('listening 4173'))"
```

然后打开 `http://localhost:4173`。

账单数据保存在浏览器 `localStorage` 中，点击右上角“记一笔”即可新增收入或支出。

## 随时随地使用

把整个目录部署到 GitHub Pages、Netlify、Vercel 等静态托管服务，拿到 `https://` 地址后，在手机浏览器打开并选择“添加到主屏幕”。项目已经包含 PWA 清单和离线缓存文件，部署后可以像独立 App 一样启动。

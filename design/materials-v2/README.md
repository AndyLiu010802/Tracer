# 材质边框第二版

运行 `node design/materials-v2/preview.cjs`，打开终端输出的本机地址。通过 HTTP 查看，以便 WebGL 读取壁纸像素；不要直接双击 HTML 使用 `file://`。

预览提供 10 款材质，鼠标改变光源，支持极光、海面和暖光环境切换。使用生产版 `skins/tracer/wallpaper-optics.js`，不会读取账户或购买商品。

水晶采样壁纸模拟折射与 RGB 色散；金属使用方向性高光和程序拉丝；木框使用连续木纹、孔隙、拼角、凹槽以及漆面反光。其余材质保留各自的粗糙度与表面表现。渲染中心透明，实际应用中的文字与控件不参与折射。

验证：`dev/qa-wallpaper-materials.cjs` 和 `dev/qa-wallpaper-shop.cjs`。全尺寸示例见 `glass.png`、`titanium.png`、`walnut.png`。

/**
 * 极简 Markdown 转 HTML 解析器 - Pro Version
 * 针对 AI 摘要场景优化：修复嵌套列表、对齐问题及多余换行
 */
function parse(md) {
  if (!md) return '';

  const baseStyle = `font-size:var(--fs-card); line-height:var(--lh-std); color:var(--content-text);`;

  let html = md
    // 1. 处理加粗: 使用 --content-bold
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:var(--fw-bold); color:var(--content-bold);">$1</strong>')
    
    // 2. 处理行内代码
    .replace(/`(.*?)`/g, '<code style="background:var(--content-code-bg); padding:2px 4px; border-radius:4px; font-family:var(--font-mono); font-size:0.9em;">$1</code>')
    
    // 3. 处理二级列表 (带缩进的 - )
    // 使用 flex 布局确保小圆圈与文字对齐
    .replace(/^ {1,4}- (.*)$/gm, `<div style="display:flex; align-items:flex-start; margin-bottom:8rpx; margin-left:36rpx;">
      <span style="color:var(--content-bullet); margin-right:12rpx; font-size:0.8em; opacity:0.8; line-height:var(--lh-std);">○</span>
      <div style="flex:1;">$1</div>
    </div>`)

    // 4. 处理一级列表 (行首的 - )
    .replace(/^- (.*)$/gm, `<div style="display:flex; align-items:flex-start; margin-bottom:12rpx;">
      <span style="color:var(--content-bullet); margin-right:12rpx; font-weight:var(--fw-bold); line-height:var(--lh-std);">•</span>
      <div style="flex:1;">$1</div>
    </div>`)

    // 5. 精细化处理剩余换行
    // 逻辑：将文本按行拆分，如果某一行不是以列表 div 开头的，且有内容，则补一个 br
    .split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed && !line.includes('<div') && !line.includes('</div')) {
        return line + '<br/>';
      }
      return line;
    }).join('');

  // 最终包装
  html = `<div style="${baseStyle}">${html}</div>`;

  return html;
}

module.exports = {
  parse
};

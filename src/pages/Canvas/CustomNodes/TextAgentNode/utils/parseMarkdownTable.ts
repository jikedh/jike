/**
 * 解析 Markdown 表格格式，提取角色数据
 * 用于 novel-character-design 预设类型
 */
export interface CharacterData {
  '姓名': string
  '基础设定': string
  '性格特征': string
  '核心动机': string
  '核心关系': string
  '习惯和兴趣': string
}

export const parseMarkdownTable = (markdown: string): CharacterData[] => {
  const characters: CharacterData[] = []
  
  // 匹配 Markdown 表格行
  const lines = markdown.split('\n')
  const tableRows: string[] = []
  let inTable = false
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    // 检测表格行（以 | 开头和结尾）
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      // 跳过分隔行（如 |---|---|）
      if (/^\|[\s\-:|]+\|$/.test(trimmedLine)) {
        continue
      }
      tableRows.push(trimmedLine)
      inTable = true
    } else if (inTable && trimmedLine === '') {
      // 空行结束表格
      break
    }
  }
  
  // 跳过表头行，从第二行开始解析数据
  for (let i = 1; i < tableRows.length; i++) {
    const row = tableRows[i]
    // 分割单元格
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
    
    if (cells.length >= 6) {
      characters.push({
        '姓名': cells[0],
        '基础设定': cells[1],
        '性格特征': cells[2],
        '核心动机': cells[3],
        '核心关系': cells[4],
        '习惯和兴趣': cells[5],
      })
    }
  }
  
  return characters
}

import OSS from 'ali-oss'

const client = new OSS({
  region: import.meta.env.VITE_OSS_REGION,
  accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID,
  accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET,
  bucket: import.meta.env.VITE_OSS_BUCKET,
})

export async function uploadFileToOSS(file: File) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  // 根据扩展名自动判断目录
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv']
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac']

  let directory = 'images'
  if (videoExts.includes(ext)) {
    directory = 'videos'
  } else if (audioExts.includes(ext)) {
    directory = 'audios'
  }

  const fileName = `${directory}/${timestamp}-${random}.${ext}`

  const result = await client.put(fileName, file)

  return { url: result.url, name: file.name }
}

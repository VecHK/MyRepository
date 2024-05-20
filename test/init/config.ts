import path from 'path'

const storage_path = path.join(__dirname, './storage')

export default {
  http_api_port: 11782,
  internal_fileserver_http_port: 11783,
  storage_path,
  filepool_path: path.join(storage_path, './files')
}

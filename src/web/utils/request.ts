import axios, { AxiosResponse } from 'axios'

const config = {
  baseURL: process.env.REACT_APP_API_PREFIX,
  timeout: 100000
}

const axiosInst = axios.create(config)

axiosInst.interceptors.request.use(
  config => config,

  err => {
    return Promise.reject(err)
  }
)

type Opts = Parameters<typeof axiosInst.request>[0]
export class RequestError extends Error {
  constructor(
    public message: string,
    public status: number,
    private opts: Opts,
    public isSilent: boolean = false,
    public description: string = ''
  ) {
    super(message)
  }

  public retry() {
    return request(this.opts)
  }
}

// type BackData<T> = T | null

export default request
async function request<Data extends unknown | null>(
  opts: Opts,
  apiRequestDescription: string = ''
) {
  const response = await axiosInst.request<Data>({
    ...opts,
  })

  const { data, status } = response
  if (status !== 200) {
    if (data !== null) {
      const error_data = data as { isError: true; message: string }
      console.warn('error_data', error_data, typeof data)
      throw new RequestError(
        error_data.message,
        status,
        opts,
        false,
        apiRequestDescription,
      )
    } else {
      throw new RequestError(
        'request failure',
        status,
        opts,
        false,
        apiRequestDescription,
      )
    }
  } else {
    return data
  }
}

function justUseTemplateString(strs: TemplateStringsArray, ...args: (number | string)[]) {
  const str = strs.reduce((a, b, idx) => {
      if (idx < args.length) {
        return `${a}${b}${args[idx]}`
      } else {
          return `${a}${b}`
      }
  }, '')
  return str
}

export function baseURL(url_strs: TemplateStringsArray, ...args: (number | string)[]) {
  const url = justUseTemplateString(url_strs, ...args)

  const base_url = process.env.REACT_APP_API_PREFIX
  if (base_url === undefined) {
    throw new Error('REACT_APP_API_PREFIX missing')
  } else {
    if ('/' === base_url[base_url.length - 1]) {
      if (url[0] === '/') {
        return `${base_url.slice(0, base_url.length - 1)}${url}`
      } else {
        return `${base_url}${url}`
      }
    } else {
      if (url[0] === '/') {
        return `${base_url}${url}`
      } else {
        return `${base_url}/${url}`
      }
    }
  }
}

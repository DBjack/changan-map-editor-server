export class AppResponse {
  static success(
    data: any = null,
    message: string = '操作成功',
    code: number = 200,
  ) {
    return {
      code,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(
    message: string = '操作失败',
    code: number = 500,
    data: any = null,
  ) {
    return {
      code,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}

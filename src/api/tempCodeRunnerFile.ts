// 获取用户会员信息
export function getMemberInfoByUUId(): any {
  return jikeingService({
    url: '/get-member-info-by-uuid',
    method: 'get',
    // params: { uuid: data.uuid || data }
    params: 1933128037681942528
  })
}
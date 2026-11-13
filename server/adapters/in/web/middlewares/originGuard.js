/** Từ chối request thay đổi trạng thái từ origin ngoài danh sách đã cấu hình. */
export function createOriginGuard(allowedOrigins = []) {
  const originSet = new Set(allowedOrigins);
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  return function originGuard(req, res, next) {
    if (safeMethods.has(req.method.toUpperCase())) return next();

    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const isSameOrigin = fetchSite !== 'cross-site' && origin === requestOrigin;
    if (fetchSite === 'cross-site' || (origin && !originSet.has(origin) && !isSameOrigin)) {
      return res.status(403).json({
        error: { code: 'CROSS_ORIGIN_REQUEST', message: 'Yêu cầu từ nguồn không được phép.' }
      });
    }
    next();
  };
}

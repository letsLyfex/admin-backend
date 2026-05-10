function getPagination(query) {
  const pageRaw = Number(query.page);
  const limitRaw = Number(query.limit);
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 20;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginationMeta(total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { total, page, limit, totalPages };
}

module.exports = { getPagination, paginationMeta };

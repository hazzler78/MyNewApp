const Platform = {
  OS: 'web',
  select: function(obj) {
    if (obj.web) return obj.web;
    if (obj.default) return obj.default;
    return obj;
  },
  Version: 1,
};

module.exports = Platform;
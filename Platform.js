const Platform = {
  OS: 'web',
  select: function(obj) {
    return obj.web || obj.default || obj;
  },
  Version: 1,
};

module.exports = Platform;
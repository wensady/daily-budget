
    // ══ 映射表 ══
    const CAT_MAP = {
      breakfast: '饮食', lunch: '饮食', dinner: '饮食',
      grocery: '饮食', meal: '饮食', snack: '饮食', transport: '交通',
      household: '日用', medical: '健康', education: '教育',
      entertainment: '娱乐', beauty: '个护', gift: '人情',
      clothes: '购物', pet: '宠物', repair: '其他', travel: '出行', other: '其他'
    };
    const CAT_COLORS = {
      '饮食': '#e67e22', '交通': '#3498db', '日用': '#8e44ad', '健康': '#e74c3c',
      '教育': '#1abc9c', '娱乐': '#f39c12', '个护': '#fd79a8', '人情': '#e91e8c',
      '购物': '#6c5ce7', '宠物': '#00b894', '出行': '#0984e3', '其他': '#b2bec3'
    };
    const SPEND_LBL = {
      breakfast: '早饭', lunch: '午饭', dinner: '晚饭',
      grocery: '买菜', meal: '吃饭', snack: '零食/饮品', transport: '交通出行',
      household: '日用品', medical: '健康/医疗', education: '学习/订阅',
      entertainment: '娱乐休闲', beauty: '个人护理', gift: '礼物/人情',
      clothes: '衣物鞋包', pet: '宠物', repair: '维修/服务', travel: '出行旅游', other: '其他'
    };
    const PLACE_LBL = {
      home_market: '家附近市场', supermarket: '超市', wet_market: '菜市场',
      convenience: '便利店', canteen: '食堂', restaurant: '餐厅',
      hospital: '医院/药店', clinic: '诊所/体检', transit: '地铁/公交站',
      mall: '商场', pharmacy: '药店', school: '学校/培训', bank: '银行/ATM',
      salon: '美发/美容', gym: '健身房',
      taobao: '淘宝/天猫', jd: '京东', pdd: '拼多多',
      meituan: '美团外卖', eleme: '饿了么', online_other: '网购'
    };
    const ONLINE_KEYS = ['taobao', 'jd', 'pdd', 'meituan', 'eleme', 'online_other'];
    const REASON_LBL = {
      daily: '日常生活', family: '家人/孩子', health: '健康就医',
      outing: '出门在外', social: '礼尚往来', invest: '投资自己', want: '想要/喜欢'
    };
    const INCOME_LBL = {
      salary: '工资', part: '兼职', bonus: '奖金',
      red: '红包', transfer: '转账', other: '其他收入'
    };

// ==UserScript==
// @name         网易BUFF插件
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  自用
// @author       Saraph1nes
// @match        http://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_info
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @include      https://buff.163.com/*
// @require      https://code.jquery.com/jquery-3.6.1.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.3.2/math.js
// @require      https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js
// ==/UserScript==

//监听ajax请求
(function (xhr) {

  var XHR = XMLHttpRequest.prototype;

  var open = XHR.open;
  var send = XHR.send;

  XHR.open = function (method, url) {
    this._method = method;
    this._url = url;
    return open.apply(this, arguments);
  };

  XHR.send = function (postData) {
    // console.log('xhr request:', this._method, this._url, postData);
    this.addEventListener('load', function () {
      // sessionStorage['key'] = JSON.stringify(response); // 插件需要添加'storage'权限
      // document.cookie
      // localStorage['key']
      window.postMessage({ type: 'xhr', data: this.response, url: this._url }, '*');  // 将响应发送到 content script
    });
    return send.apply(this, arguments);
  };
})(XMLHttpRequest);

// (function () {
//   let origFetch = window.fetch;
//   window.fetch = async function (...args) {
//     const response = await origFetch(...args);
//     console.log('fetch request:', args);
//
//     response
//       .clone()
//       .blob() // 此处需要根据不同数据调用不同方法，这里演示的是二进制大文件，比如音频
//       .then(data => {
//         // 对于二进制大文件可以创建为URL(blob:开头)，供其它脚本访问
//         //sessionStorage['wave'] = URL.createObjectURL(data); // 插件需要添加'storage'权限
//         window.postMessage({ type: 'fetch', data: URL.createObjectURL(data) }, '*'); // send to content script
//       })
//       .catch(err => console.error(err));
//     return response;
//   }
// })();

const PAGE_ENUM = {
  BUY_ORDER: 'https://buff.163.com/market/buy_order/history?game=csgo', // 购买记录
  GOODS_MARKET: 'https://buff.163.com/market/csgo#tab=selling', // 商品市场
}

const MainFunction = async () => {
  console.log('Buff脚本注入成功===>')

  /**
   * 购买记录
   */
  if (window.location.href.includes(PAGE_ENUM.BUY_ORDER)) {
    // this.$ = this.jQuery = jQuery.noConflict(true);
    const list = await getPageListByName('印花')
    console.log(list)
  }
  /**
   * 饰品市场
   */
  if (window.location.href.includes(PAGE_ENUM.GOODS_MARKET)) {
    console.log('饰品市场注入')
    window.addEventListener('message', function (e) {
      if (e.data.url.indexOf('/api/market/goods') > -1){
        const data = JSON.parse(e.data.data);
        marketPageHandler(data)
      }
    });


    // marketPageHandler()
  }
}

const marketPageHandler = async (data) => {
  // const currentPage = $('.card-pager .active')[0].innerText
  // console.log('getMarketDataRes',data)
  const goodsList = $('.card_csgo li')
  goodsList.css('height','290px')
  for (let i = 0; i < goodsList.length; i++) {
    const wantBuyPrice = data.data.items[i].buy_max_price //求购价
    const salePrice = data.data.items[i].sell_min_price // 当前售价
    const trueSalePrice = +(salePrice * 0.975).toFixed(2) // 售价到手
    const profit = +(trueSalePrice - wantBuyPrice).toFixed(2) // 利润
    $(goodsList[i]).find('p').after(`
      <p>
        <strong class="f_Strong">售价到手：${trueSalePrice}</strong>
      </p>
      <p>
        <strong class="f_Strong">求购价:<small>${wantBuyPrice}</small></strong>
      </p>
      <p>
        <strong class="f_Strong" style="color:${profit > 0 ? 'red' : 'green'}">求购利润：${profit}</strong>
      </p>
    `)
  }
}

/**
 * 根据传入name类型，筛选当前页面相关商品
 */
const getPageListByName = async (name) => {
  const goodsClassifyList = [];
  // console.log($('thead tr th').eq(3)[0].innerText)
  $('thead tr th').eq(3)[0].innerText = '购入价格'
  $('thead tr th').eq(3).after('<th class="t_Left" width="150">最高求购价</th>')
  $('thead tr th').eq(3).after('<th class="t_Left" width="150">当前售价卖出所得</th>')

  const orderList = $('.list_tb_csgo');
  const orderListTr = orderList.find($('tr'))
  for (const orderItem of orderListTr) {
    const buyPrice = Number($(orderItem).find($('td')).eq(3)[0].innerText.match(/[\d | .]+/g));// 购入价
    const nameCount = $(orderItem).find($('.name-cont'))[0]
    const goodId = nameCount.innerHTML.match(/goods\/\d+/g)[0].split('/')[1]
    if (nameCount.innerText.includes(name)) {
      if (goodsClassifyList.findIndex(item => item.goodId === goodId) === -1) {
        const getGoodsDataRes = await getGoodsData(goodId);
        // 去掉一个最高值，去掉一个最低值，求平均
        const dataItems = getGoodsDataRes.data.items;
        dataItems.pop();
        dataItems.shift();
        goodsClassifyList.push({
          goodId: goodId,
          name: orderItem.innerText,
          lowestBargainPrice: getGoodsDataRes.data.items[0].lowest_bargain_price,// 最高求购价
          price: _.meanBy(dataItems, o => {
            return +o.price;
          }).toFixed(2),// 当前最低售价的平均值
          // buyPrice: buyPrice,// 购入价
        })
        console.log('列表', goodsClassifyList)
      }
    }
    // console.log('ttt',goodsClassifyList.find(item => item.goodId === goodId).lowestBargainPrice)
    // $(orderItem).find($('td')).eq(3).after(`<td class="t_Left"> <strong class="f_Strong">${goodsClassifyList.find(item => item.goodId === goodId) ? mathCount(`${goodsClassifyList.find(item => item.goodId === goodId).price} * 0.975`) : '--'}</strong></td>`)
    $(orderItem).find($('td')).eq(3).after(`
      <td class="t_Left">
        <strong class="f_Strong">
          ${goodsClassifyList.find(item => item.goodId === goodId) ? goodsClassifyList.find(item => item.goodId === goodId).lowestBargainPrice : '--'}
        </strong>
      </td>
    `)
    // $(orderItem).find($('td')).eq(3).after(`<td class="t_Left"> <strong class="f_Strong">${goodsClassifyList.find(item => item.goodId === goodId) ? goodsClassifyList.find(item => item.goodId === goodId).price : '--'}</strong></td>`)

    $(orderItem).find($('td')).eq(3).after(`
      <td class="t_Left">
        <strong class="f_Strong" style="color: ${getSaleProfits(goodsClassifyList, goodId, buyPrice) > 0  ? 'red' : 'green'}">
            ${getSaleProfits(goodsClassifyList, goodId, buyPrice) ? getSaleProfits(goodsClassifyList, goodId, buyPrice) : '--'}
        </strong>
      </td>
    `)
  }
  return goodsClassifyList;
}

/**
 * 获取利润
 */
const getSaleProfits = (goodsClassifyList, goodId, buyPrice) => {
  const find = goodsClassifyList.find(item => item.goodId === goodId);
  if (find){
    return mathCount(`${find.price} * 0.975 - ${buyPrice}`)
  } else {
    return null
  }
}

/**
 * 传入表达式，返回结果
 */
const mathCount = (expression) => {
  return Number(math.format(math.evaluate(expression), {precision: 14})).toFixed(2)
}

/**
 * 根据商品Id查询详情
 */
const getGoodsData = async (goodsId) => {
  return await new Promise((resolve, reject) => {
    try {
      $.get(`https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id=${goodsId}&page_num=1&sort_by=default&mode=&allow_tradable_cooldown=1&_=1667712857879`, (res) => {
        resolve(res)
      })
    } catch (e) {
      reject(e)
    }
  })
}

MainFunction();//主函数执行
import React, { Component } from 'react';
import './App.css';
import Socket from 'socket.io-client';
import { isNullOrUndefined } from 'util';
import idb from 'idb';
//import cityData from '../city.list.json';

class App extends Component {
  render() {
    return (
      <div className="App">
        <div className="topPerspective"></div>
          <div className="App-intro">
            <MainComponent />
          </div>
      </div>
    );
  }
  
}

class MainComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      appTitle: `Crypto Prices`, 
      listOfSubscribedItems: new Set(), 
      listOfOriginalItems: new Set([]), 
      searchMatches: new Set([]), 
      searchText: '',
      searchCurrItemIndex: 0,
      itemsFetched: false 
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.removeSubscribedItem = this.removeSubscribedItem.bind(this);
  }

  async getListSearchItems() {
      //list of cities
      //console.log(cityData.length);
      // const fetchData = await fetch('city.list.json', {
      //   headers : { 
      //     'Content-Type': 'application/json',
      //     'Accept': 'application/json'
      //    }
      // })
      // const resultData = await fetchData.json() 
      // console.log(resultData);
      // console.log(resultData.map(item => {
      //    const itemObj = JSON.parse(JSON.stringify(item));
      //    return '{ id=' + itemObj.id + ', name=' + item.name + ' }';
      // }).join());
    
      let getExistingItems = await this.getItemsLocally();
      let items;
      try {
          const fetchCoinList = await fetch('https://min-api.cryptocompare.com/data/all/coinlist', {
            'mode' : 'cors' 
          },
        );
        const resultCoinList = await fetchCoinList.json(); 
        items = Object.values(resultCoinList.Data).sort((a,b) => a.FullName.localeCompare(b.FullName));
      }
      catch(e) {
        console.log(e)
      }
      finally {
        getExistingItems = getExistingItems.size === 0 ? new Set([...items].filter(s => [`BTC`,`ETH`,`LTC`,`DASH`,`XRP`].includes(s.Symbol))) : getExistingItems;  
        this.setState({ 
          listOfOriginalItems: new Set([...items]),
          listOfSubscribedItems: getExistingItems,
          itemsFetched:true
        },() => {
            this.storeItemsLocally();
            this.getPricesSubscribed();
        })
      }
  }

  async getPricesSubscribed() {
    if(this.state.listOfSubscribedItems.size === 0)
      return;
      
    if(this.socket)
    {
      //console.log(`Closing exisiting socket listener`)
      this.socket.off("SubAdd")
    }

    //console.log('intiating socket.io')
    this.socket = Socket('wss://streamer.cryptocompare.com');
    let subscription = [...this.state.listOfSubscribedItems].map(s => `5~CCCAGG~${s.Symbol}~USD`) 
    //console.log(subscription)
    //subscription = ['2~Poloniex~BTC~USD', '2~Poloniex~ETH~USD', '2~Poloniex~XRP~USD'];
    this.socket.emit('SubAdd', { subs: subscription } );               
    this.socket.on("m", message => this.updatePrices(message));
  }

  async updatePrices(message) {
    //console.log(message);
    const responseItems = message.split(`~`)
    this.priceChangeType = () => {
      if(responseItems[4] === `1`)
        return "Up"
      if(responseItems[4] === `2`)
        return "Down"
      if(responseItems[4] === `4`)
        return "UnChanged"
    };

    const updatedPricedItems = [...this.state.listOfSubscribedItems].map(s => {
      return { FullName: s.FullName, Id: s.Id, Symbol: s.Symbol
        , Price: s.Symbol === responseItems[2] ? (((responseItems[4] === `4` && isNullOrUndefined(s.Price)) || responseItems[4]) !== `4` ? responseItems[5] : s.Price) : s.Price
        , PriceChangeType: s.Symbol === responseItems[2] ? responseItems[4] : s.PriceChangeType 
      };
    })
    //console.log(`${responseItems[2]} - ${responseItems[3]} price with flag as ${responseItems[4]} is ${this.priceChangeType()} ${responseItems[4] !== '4' ? 'with $' + responseItems[5] + ' in US dollars' : ''} `)
    this.setState({ listOfSubscribedItems: updatedPricedItems})
  }

  componentDidMount()
  {
    this.refs.searchTxtInput.focus(); 
    this.getListSearchItems();
    this.getPricesSubscribed();
  }

  async handleKeyMove(e) {  
    if(e.keyCode === 13) return;
    let searchCurrItem = 0;
    const srchItems = [...this.state.searchMatches]
    const srchItemIndex = srchItems.findIndex(s => s.Id === this.state.searchCurrItemIndex)
    if([38,40].includes(e.keyCode) && (this.state.searchMatches.size > 0))
    {
      if(e.keyCode === 38 && srchItemIndex > 0) // up
      {
          searchCurrItem = srchItems[srchItemIndex - 1]["Id"]
      }
      else if(e.keyCode === 38 && srchItemIndex === 0) // up
      {
          searchCurrItem = srchItems[srchItems.length - 1]["Id"]
      }
      else if(e.keyCode === 40 && srchItemIndex < srchItems.length - 1) // down
      {
        searchCurrItem = srchItems[srchItemIndex + 1]["Id"]
      }
    }
    this.setState({
      searchCurrItemIndex: searchCurrItem
    })
  }

  handleSelect(val) {
    const newItems = [...this.state.listOfSubscribedItems]; 
    [...this.state.searchMatches].filter(item => item.Id === val).map(s => {
      const newItem = { FullName:  s.FullName, Id: s.Id, Symbol: s.Symbol, Price: null, PriceChangeType: null };
      return newItems.push(newItem)
    })
    const revisedItems = newItems.filter((val, idx, arr) => arr.findIndex(s => s.Id === val.Id) === idx)
    this.setState(({
      listOfSubscribedItems: new Set(revisedItems),
      searchMatches: new Set([])
    }),() => {
      this.refs.searchTxtInput.value = ``;
      this.storeItemsLocally(); 
      this.getPricesSubscribed()
    })
  }

  async handleChange(e) {
    const searchTxt = e.target.value;
    const searchItems = await this.findMatches(searchTxt);
    this.setState({
      searchText: searchTxt,
      searchMatches: searchItems.length > 0 ? new Set(searchItems) : new Set([])
    }) 
  }

  handleSubmit(e) {
    e.preventDefault()
    //console.log(this.state.searchCurrItemIndex)
    this.handleSelect(this.state.searchCurrItemIndex)
  }

  removeSubscribedItem(Id) {
    const newItems = [...this.state.listOfSubscribedItems]; 
    const revisedItems = newItems.filter(s => s.Id !== Id)
    this.setState(({
      listOfSubscribedItems: new Set(revisedItems),
      searchMatches: new Set([])
    }),() => {
      this.storeItemsLocally();
      this.getPricesSubscribed()
    })
  }
  async findMatches(wordToMatch) {
    return (wordToMatch.length > 0 ? 
                  [...this.state.listOfOriginalItems].filter(item => {
                    const searchRegex = new RegExp(wordToMatch.replace(`\\`, `\\\\`), 'gi');
                    return item.FullName.match(searchRegex);
                  }) 
              : []
           );
  };

  getDbContext() {
    return idb.open('CryptoPriceDatabase', 1, upgradeDB => {
      switch (upgradeDB.oldVersion) {
        case 1:
          upgradeDB.createObjectStore('CryptoPriceList', {keyPath: 'id', autoIncrement:true});
          break;
        default:
          upgradeDB.createObjectStore('CryptoPriceList', {keyPath: 'id', autoIncrement:true});  
      }
    });
  }

  storeItemsLocally() {
    this.getDbContext()
        .then(db => {
          const tx = db.transaction('CryptoPriceList', 'readwrite');
          tx.objectStore('CryptoPriceList').clear();
          this.state.listOfSubscribedItems.forEach(s => {
            tx.objectStore('CryptoPriceList').put({Id:s.Id, Symbol:s.Symbol, FullName: s.FullName})
          });
          return tx.complete;
        })
        .catch(err => {
          console.log(`Error: ${err}`)
          return false;
        });
  }

  getItemsLocally() {
    let listItems = new Set();
    return this.getDbContext()
                .then(db => {
                  return db.transaction('CryptoPriceList').objectStore('CryptoPriceList').getAll();
                })
                .then(allObjs => {
                  [...allObjs].map(s => listItems.add({ FullName: s.FullName, Id: s.Id, Symbol: s.Symbol, Price: null, PriceChangeType: null }));
                  return listItems;
                })
                .catch(err => {
                  console.log(`Error: ${err}`)
                  return listItems;
                });
  }

  render() {
    return (
      <div>
        <div>
          <span className="App-title">{this.state.appTitle}</span>
        </div>
        <div>
          <form onSubmit={this.handleSubmit}>
            <div className="search-dropdown" >        
                <input
                  id="new-location"
                  onChange={async (e) => this.handleChange(e)}
                  onKeyDown={async (e) => this.handleKeyMove(e)}
                  ref="searchTxtInput"
                  placeholder={this.state.itemsFetched === true && this.state.listOfOriginalItems.size > 0 
                                      ? "awaiting input to search for coins.." 
                                      : (this.state.itemsFetched === true && this.state.listOfOriginalItems.size === 0 
                                                ? "list of coins currently not available to search.." 
                                                : "loading list of coins.."
                                        )
                              }
                  autoComplete="off"
                  type="text"
                />
                <SearchList 
                  ref={instance => { this.child = instance; }}
                  parentState={this.state} 
                  onSelect={this.handleSelect}
                />
            </div>
          </form>
        </div>
        <div>
          <ItemList 
            items={this.state.listOfSubscribedItems} 
            onRemoveSubscribedItem={this.removeSubscribedItem}
          />
        </div>
      </div>
    );
  }

}

class ItemList extends React.Component {
  constructor(props) {
    super(props);
    this.getItemText = this.getItemText.bind(this)
    this.removeItem = this.removeItem.bind(this)
  }
  removeItem(itemObj)
  {
    //console.log(`delete ${itemObj.Id}`)
    this.props.onRemoveSubscribedItem(itemObj.Id)
  }
  getItemText(itemObj) {
    const updateType = !isNullOrUndefined(itemObj.PriceChangeType) ? itemObj.PriceChangeType.replace(`4`,`+/- $`).replace(`1`,` + $`).replace(`2`,` - $`) : ``
    return  <span className='list-item-container'>  
              <span className='list-item'>{ `${itemObj.Symbol}\\USD - ${itemObj.FullName}` }</span>
              <span className='list-item' { ...{ style : { 'color' : (itemObj.PriceChangeType === `1` ? `green` : (itemObj.PriceChangeType === `2` ? `red` : `lightyellow`)) }}}
                >{ !isNullOrUndefined(itemObj.Price) ? `${updateType}${itemObj.Price}` : `N/A` }</span>
              <span className='list-item' onClick={() => this.removeItem(itemObj)} title='Delete?' >X</span>
            </span>;
}

  render() {
    const itemsArr = [...this.props.items]
    if(itemsArr.length > 0)
    {
      return (
            <div className="div-list-items">
              <span className="div-list-title">List of Coins</span>
              <ul id="tblItem" className="item-content-ul">
              { 
                itemsArr.map((item) => { 
                  return (
                            <li 
                              id={`TblId-${item.Id}`} 
                              key={`TblId-${item.Id}`} 
                              data-id={item.Id}
                              className="item-content-li"
                            >{this.getItemText(item)}</li>
                          )
                })
              }
              </ul>
             </div> 
             )
    }
    else
    {
      return null
    }
  }
}

class SearchList extends React.Component {
  constructor(props) {
    super(props);
    this.handleSelect = this.handleSelect.bind(this)
  }

  handleSelect(e) {
    this.props.onSelect(e.currentTarget.dataset.id)
  }

  returnItemText(val) {
    const highlight = this.props.parentState.searchText.replace(`\\`, `\\\\`);
    let parts = val.split(new RegExp(`(${highlight})`, 'gi'));
    return <span> { parts.map((part, i) => 
        <span key={i} className={part.toLowerCase() === highlight.toLowerCase() ? `inline-search-text` : ``}>
            { part }
        </span>)
    } </span>;
  }

 
  render() {
    const searchItemsArr = [...this.props.parentState.searchMatches]
    const searchHeight = searchItemsArr.length > 5 ? 30 : searchItemsArr * 3 
    return (
      <div className="search-dropdown-content" {...searchItemsArr.length > 0 && {style : {'--searchbox-height': `${searchHeight}vmax`}}} >
        <ul id="Srchdpdnlst" ref="Srchdpdnlst" >
          {searchItemsArr.map((item,index) => (
              <li 
                id={`SearchId-${index}-${item.Id}`} 
                key={`SearchId-${item.Id}`} 
                onClick={this.handleSelect} 
                data-id={item.Id}
                className={(item.Id === this.props.parentState.searchCurrItemIndex ? "search-dropdown-content-li li-active" : "search-dropdown-content-li")} 
              >{this.returnItemText(item.FullName)}</li>
          ))
          }
        </ul>
      </div>
    );
  }
}

export default App;

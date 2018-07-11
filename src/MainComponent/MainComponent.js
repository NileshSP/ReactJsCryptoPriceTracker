import React from 'react';
import Socket from 'socket.io-client';
import './MainComponent.css';
import { isNullOrUndefined } from 'util';
import idb from 'idb';
import SearchList from '../SearchListComponent/SearchList'
import ItemList from '../ItemListComponent/ItemList'
//import cityData from '../city.list.json';

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
      itemsFetched: false,
      searchHeight: 0 
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleBlur = this.handleDisplay.bind(this);
    this.handleFocus = this.handleDisplay.bind(this);
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
        const listOrigItems = new Set(items === undefined ? [] : [...items]);
        getExistingItems = getExistingItems.size === 0 ? new Set([...listOrigItems].filter(s => [`BTC`,`ETH`,`LTC`,`DASH`,`XRP`].includes(s.Symbol))) : getExistingItems;  
        this.setState({ 
          listOfOriginalItems: listOrigItems,
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

  async handleDisplay(display) {
    const srchMatches = this.state.searchMatches
    const searchHeightVal = display === false 
                                        ? 0 
                                        : srchMatches.size > 0 
                                                                  ? srchMatches.size > 5 ? 30 : srchMatches.size * 3
                                                                  : 0 
    this.setState({
      searchHeight: searchHeightVal
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
      searchMatches: new Set([]),
      searchHeight: 0
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
      searchMatches: searchItems.length > 0 ? new Set(searchItems) : new Set([]),
      searchHeight: searchItems.length > 0 
                        ? searchItems.length > 5 ? 30 : searchItems * 3  
                        : 0
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
      <div className="App-intro">
        <div className="topPerspective"></div>
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
                  onBlur={async () => this.handleDisplay(false)}
                  onFocus={async () => this.handleDisplay(true)}
                  ref="searchTxtInput"
                  placeholder={this.state.itemsFetched === true && this.state.listOfOriginalItems.size > 0 
                                      ? "awaiting input to search for coins.." 
                                      : (this.state.itemsFetched === true && this.state.listOfOriginalItems.size === 0 
                                                ? "list of coins currently not available due to lack of internet availability..." 
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

export default MainComponent;

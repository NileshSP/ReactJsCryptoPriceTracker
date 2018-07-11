import React from 'react';
import './ItemList.css';
import { isNullOrUndefined } from 'util';

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


export default ItemList;

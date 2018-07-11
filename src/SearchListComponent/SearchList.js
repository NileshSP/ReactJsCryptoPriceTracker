import React from 'react';
import './SearchList.css';

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
    const searchHeight = this.props.parentState.searchHeight 
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

export default SearchList;

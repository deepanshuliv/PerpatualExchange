import Balance from "./balance";
import ORDERBOOK from "./orderBook";

export default class  MatchingEngine{
    private orderBook;
    private balance ;

    constructor(){
        this.orderBook = new  ORDERBOOK();
        this.balance = new Balance()
    }

    createOrder(){}
    cancelOrder(){}
    getOrder(){}
    getBalance(){}

}
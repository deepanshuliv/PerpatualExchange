import type { User } from "types";

 export default class  Balance{
   private user: User ;
   constructor(){
    this.user = {}
   }

   createUserBalanceAccount(userId:string){
    let userAvailabel =  this.user[userId];
    if(!userAvailabel){
        userAvailabel = {
            balance : 1000,
            lockedBalance : 0 
        }
    }
    return {ok:true, msg:"USER_BALANCE_ADDED"}
   }

   getBalance(userId:string){
    if(!this.user[userId]){
        return {ok:false ,msg:"USER_NOT_PRESENT"}
    }
    return {ok:true , balance:this.user[userId].balance}
   }

   updateBalance(userId : string , signedAmount: number){
    if(!this.user[userId]){
        return {ok:false ,msg:"USER_NOT_PRESENT"}
    }

    balance:this.user[userId].balance -= signedAmount;

    return {ok:true , }
   }

   addBalance(userId :string , amount : number){
    if(!this.user[userId]){
        return {ok : false, msg: "USER_NOT_PRESENT"}
    }  
    this.user[userId].balance+=amount
   }
   updateLockedBalance(userId  : string, signedAmount : number){
    if(!this.user[userId]){
        return {ok : false, msg: "USER_NOT_PRESENT"}
    }  
    this.user[userId].balance+=signedAmount 
   }

   addLockedBalance(userId: string , amount : number){
    if(!this.user[userId]){
        return {ok : false, msg: "USER_NOT_PRESENT"}
    }  
    this.user[userId].balance+=amount
   }
   getLockedBalance(userId : string ){
    if(!this.user[userId]){
        return {ok : false, msg: "USER_NOT_PRESENT"}
    }  
    return {ok : true , lockedBalance: this.user[userId].lockedBalance}
   }
   

 }
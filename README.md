## Stratigies to make it more enhanced 

- lazy deleting -> mean as delet come you store its orderId and status in a map and when we are hadling the open order in orderbook , we check that if current order is not present in the map using orderID and userId.





## Current behaviour
- order can be stored in array, deque doubly linked list both has same complexity .

- now from frontend in market order price will come alongwith qty , but price has a slippage that is calculated on frontend . Price should come after applying this slippage.

- In fills DS we are storing , seprate entry for maker_order_id and seller_order_id but in one fills i am storing both seller_user_id and buyer_user_id

- currently cancel a open order Take o(n) time with lazy deleting it can become o(1).
- write now any order after liquidation will leave on orderBook forever.
- in order to close position you need to send equity = 0 
## Difficult questions 
- what if i place the liquidation order and opposiet side giving me worst price what should happen ? because right now my while loop is running and consuming all  orders until he sells complete qty .
- 



## Concepts that learned while making this project 
- but we are taking and make sure that we provdie pure inputs to funciton so that get always valid answer. 
- as we are writing any function than we first need to check validation (check all the invalid conditions) and than write mutation (change value of variabels)
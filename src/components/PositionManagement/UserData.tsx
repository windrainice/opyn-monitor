import React, { useState, useMemo } from 'react';
import BigNumber from 'bignumber.js'

import { Tabs } from '@aragon/ui'

import Positions from './MyPositions'
import Balances from './Balances'
import History from './TradeHistory'

import { Comment } from '../common'

import { getUserOptionBalances } from '../../utils/graph'
import { eth_calls, eth_puts } from '../../constants/options'

const allOptions = eth_puts.concat(eth_calls).filter((o) => o.expiry > Date.now() / 1000)

type UserDataProps = {
  user: string,
  spotPrice: BigNumber
  tokenPrices: {
    oToken: string,
    price: BigNumber
  }[]
}

function UserData({ user, spotPrice, tokenPrices }: UserDataProps) {

  const [selectedTab, setSelectedTab] = useState(2)
  const [balances, setBalances] = useState<balance[]>([])

  // update token balances for all options
  useMemo(async () => {
    if (!user) return
    const balances = (await getUserOptionBalances(user))
      .filter(obj=> allOptions.find(option => option.addr === obj.oToken))
      .map(obj=> {
      return {
        oToken: obj.oToken,
        balance: new BigNumber(obj.balance)
      }
    })

    setBalances(balances)
  }, [user]);

  return (
    <>
      <Tabs
        items={['Positions', 'Balances', 'History']}
        selected={selectedTab}
        onChange={setSelectedTab}
      />
      {
        user === ''
          ? <Comment text="Connect wallet to see more detail"></Comment>
          : (selectedTab === 0 ? <Positions
            user={user}
            spotPrice={spotPrice}
            tokenPrices={tokenPrices}
            balances={balances}
          /> : selectedTab === 1 ? <Balances 
            balances={balances}
            tokenPrices={tokenPrices}
            allOptions={allOptions}
          /> : <History user={user} allOptions={allOptions} />
          )

      }
    </>
  );
}

export default UserData;


type balance = {
  oToken: string,
  balance: BigNumber
}
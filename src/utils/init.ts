import BigNumber from 'bignumber.js';

import * as types from '../types';
import { getAllOptions, getUniswapExchanges, optionTheGraph } from './graph';
import { getUniswapExchangeAddress, getERC20Symbol, getERC20Name } from './infura';
import { USDC, OPYN_ETH, cDAI, cUSDC, CurveFi, WETH, DAI, yDAI } from '../constants/tokens';
import { blackList } from '../constants/options'
import { EMPTY_EXCHANGE } from '../constants/contracts';

import { getPreference, storePreference } from './storage';

import Promise from 'bluebird';

const tokens = [USDC, OPYN_ETH, cDAI, cUSDC, CurveFi, WETH, DAI, yDAI];
const ERC20InfoAndExchangeKey = 'ERC20InfoAndExchanges';

type storedERC20Info = {
  address: string;
  name: string;
  symbol: string;
  uniswapExchange: string;
};

/**
 * Called once when website is loaded.
 */
export const initOptions = async (): Promise<{
  insurances: types.optionWithStat[];
  puts: types.optionWithStat[];
  calls: types.optionWithStat[];
}> => {
  const storedErc20InfoAndExchanges: storedERC20Info[] = JSON.parse(
    getPreference(ERC20InfoAndExchangeKey, '[]')
  );

  // get options from the graph
  const alloptions = formatOptionsFromTheGraph(await getAllOptions());

  // get all uniswap exchanges from the graph
  const addrs = alloptions.map((o) => o.addr);
  const exchanges = await getUniswapExchanges(addrs);

  const options = await Promise.map(alloptions, async (option: basicOptionInfo) => {

    if (blackList.includes(option.addr)) return;

    const collateralToken = tokens.find((token) => token.addr === option.collateral);
    const strikeToken = tokens.find((token) => token.addr === option.strike);
    const underlyingToken = tokens.find((token) => token.addr === option.underlying);

    if (!collateralToken || !strikeToken || !underlyingToken) {
      return;
    }

    let _exchange = exchanges.find((exchange) => exchange.tokenAddress === option.addr);

    if (option.addr === '0xddac4aed7c8f73032b388efe2c778fc194bc81ed' && _exchange) {
      _exchange.tokenName = 'Opyn cDai Insurance (Old)';
    }

    // The graph doesn't have exchagne record.  (probabaly because it's newly created).
    // Check Local storage or query Infura instead.
    if (_exchange === undefined) {
      const storedInfo = storedErc20InfoAndExchanges.find((entry) => entry.address === option.addr);
      if (storedInfo !== undefined) {
        _exchange = {
          id: storedInfo.uniswapExchange,
          tokenAddress: option.addr,
          tokenName: storedInfo.name,
          tokenSymbol: storedInfo.symbol,
        };
      } else {
        // Query Infura
        const uniswapExchange = await getUniswapExchangeAddress(option.addr);

        // no exchange: ignore.
        if (uniswapExchange === EMPTY_EXCHANGE) {
          return;
        }

        const name = await getERC20Name(option.addr);
        const symbol = await getERC20Symbol(option.addr);

        storedErc20InfoAndExchanges.push({
          address: option.addr,
          name,
          symbol,
          uniswapExchange,
        });

        _exchange = {
          id: uniswapExchange,
          tokenAddress: option.addr,
          tokenName: name,
          tokenSymbol: symbol,
        };
      }
    }

    return {
      ...option,
      title: _exchange?.tokenName,
      symbol: _exchange?.tokenSymbol,
      name: _exchange?.tokenName,
      uniswapExchange: _exchange?.id,

      type: 'insurance',

      collateral: collateralToken,
      underlying: underlyingToken,
      strike: strikeToken,
    };
  }).filter((o) => o);

  storePreference(ERC20InfoAndExchangeKey, JSON.stringify(storedErc20InfoAndExchanges));

  return categorizeOptions(options);
};

/**
 * Convert options into insurnace, puts, and calls
 * @param options
 */
const categorizeOptions = (
  options: types.optionWithStat[]
): {
  insurances: types.optionWithStat[];
  puts: types.ethOptionWithStat[];
  calls: types.ethOptionWithStat[];
} => {
  const insurances: types.optionWithStat[] = [];
  const puts: types.ethOptionWithStat[] = [];
  const calls: types.ethOptionWithStat[] = [];

  options.forEach((option) => {
    if (option.name === '') return;
    if (option.collateral === USDC && option.strike === USDC && option.underlying === OPYN_ETH) {
      const strikePriceInUSD = parseInt(option.name.split('$')[1].split(' ')[0], 10);
      const put = {
        ...option,
        type: 'put' as 'put',
        strikePriceInUSD,
      };
      puts.push(put);
    } else if (
      option.collateral === OPYN_ETH &&
      option.strike === OPYN_ETH &&
      option.underlying === USDC
    ) {
      const strikePriceInUSD = parseInt(option.name.split('$')[1].split(' ')[0], 10);
      const call = {
        ...option,
        type: 'call' as 'call',
        strikePriceInUSD,
      };
      calls.push(call);
    } else {
      insurances.push(option);
    }
  });

  return { insurances, puts, calls };
};

export type basicOptionInfo = {
  addr: string;
  strike: string;
  underlying: string;
  collateral: string;
  oracle: string;
  exchange: string;
  minRatio: number;
  decimals: number;
  strikePrice: number;
  expiry: number;
  totalCollateral: BigNumber;
  totalExercised: BigNumber;
  totalSupply: BigNumber;
};

const formatOptionsFromTheGraph = (data: optionTheGraph[]): basicOptionInfo[] => {
  const result = data.map((entry) => {
    return {
      addr: entry.address,
      strike: entry.strike,
      underlying: entry.underlying,
      collateral: entry.collateral,
      expiry: parseInt(entry.expiry),
      oracle: entry.oracleAddress as string,
      exchange: entry.optionsExchangeAddress as string,
      minRatio: new BigNumber(entry.minCollateralizationRatioValue)
        .times(new BigNumber(10).exponentiatedBy(new BigNumber(entry.minCollateralizationRatioExp)))
        .toNumber(),
      decimals: -1 * parseInt(entry.oTokenExchangeRateExp),

      strikePrice: new BigNumber(entry.strikePriceValue)
        .times(new BigNumber(10).exponentiatedBy(new BigNumber(entry.strikePriceExp)))
        .toNumber(),
      totalCollateral: new BigNumber(entry.totalCollateral),
      totalExercised: new BigNumber(entry.totalExercised),
      totalSupply: new BigNumber(entry.totalSupply),
    };
  });
  return result;
};
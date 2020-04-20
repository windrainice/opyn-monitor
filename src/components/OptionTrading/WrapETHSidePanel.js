/* eslint-disable consistent-return */
import React, { useState, useEffect } from 'react';
import BigNumber from 'bignumber.js';
import PropTypes from 'prop-types';

import {
  SidePanel, Button, TextInput, Split,
} from '@aragon/ui';
import { BalanceBlock, SectionTitle, Comment } from '../common';

import { wrapETH, unwrapETH } from '../../utils/web3';
import { toBaseUnitBN, toTokenUnitsBN } from '../../utils/number';
import { getBalance } from '../../utils/infura';

function WrapETHModal({
  user, wethBalance, opened, setOpen,
}) {
  const [wrapAmount, setWrapAmount] = useState(BigNumber(0));
  const [unWrapAmount, setUnwrapAmount] = useState(BigNumber(0));

  const [ethBalance, setETHBalance] = useState(BigNumber(0));

  const onChangeWrapAmount = (event) => {
    const amount = event.target.value;
    if (!amount) {
      setWrapAmount(new BigNumber(0));
      return;
    }
    setWrapAmount(new BigNumber(amount));
  };

  const onChangeUnWrapAmount = (event) => {
    const amount = event.target.value;
    if (!amount) {
      setUnwrapAmount(new BigNumber(0));
      return;
    }
    setUnwrapAmount(new BigNumber(amount));
  };

  useEffect(() => {
    if (!opened || !user) return;
    let isCancelled = false;

    const updateETHBalance = async () => {
      if (user === '') return;
      const quoteBalance = await getBalance(user);
      if (!isCancelled) {
        setETHBalance(new BigNumber(quoteBalance));
      }
    };
    updateETHBalance();
    const idETHBalance = setInterval(updateETHBalance, 20000);
    return () => {
      isCancelled = true;
      clearInterval(idETHBalance);
    };
  }, [opened, user]);

  return (
    <SidePanel
      opened={opened}
      onClose={() => { setOpen(false); }}
    >
      <br />
      <SectionTitle title="Wrap WETH" />
      <div style={{ padding: '2%' }}>
        <BalanceBlock asset="Your ETH Balance" balance={ethBalance.toNumber()} />
      </div>

      {/* </div> */}
      <Split
        primary={<TextInput wide type="number" value={wrapAmount.toNumber()} onChange={onChangeWrapAmount} />}
        secondary={(
          <Button
            onClick={() => {
              wrapETH(toBaseUnitBN(wrapAmount, 18).toString());
            }}
            label="Wrap"
          />
          )}
      />
      <Comment text="After you wrap your ETH to WETH, you can unwrap them back to ETH anytime." />
      <br />
      <SectionTitle title="Unwrap WETH" />
      <div style={{ padding: '2%' }}>
        <BalanceBlock asset="Your WETH Balance" balance={toTokenUnitsBN(wethBalance, 18).toNumber()} />
      </div>
      <Split
        primary={<TextInput wide type="number" value={unWrapAmount.toNumber()} onChange={onChangeUnWrapAmount} />}
        secondary={(
          <Button
            onClick={() => {
              unwrapETH(toBaseUnitBN(unWrapAmount, 18).toString());
            }}
            label="Unwrap"
          />
          )}
      />
    </SidePanel>
  );
}


WrapETHModal.propTypes = {
  user: PropTypes.string.isRequired,
  wethBalance: PropTypes.instanceOf(BigNumber).isRequired,
  opened: PropTypes.bool.isRequired,
  setOpen: PropTypes.func.isRequired,
};

export default WrapETHModal;

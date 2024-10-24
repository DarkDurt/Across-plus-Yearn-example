'use client'

import dynamic from 'next/dynamic'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Loader2, Wallet } from "lucide-react"
import React from 'react'
import { ethers } from 'ethers'
import { checkAllowance, approveToken, initiateBridgeDeposit } from '@/functions/acrossFunctions';

const tokenVaults = [
  { symbol: 'USDT Vault', name: 'USD Tether Vault' },
]

const BridgeAndDepositClient = dynamic(() => Promise.resolve(BridgeAndDepositComponent), { ssr: false })

function BridgeAndDepositComponent() {
  const [amount, setAmount] = React.useState('')
  const [selectedToken, setSelectedToken] = React.useState('')
  const [bridging, setBridging] = React.useState(false)
  const [approving, setApproving] = React.useState(false)
  const [bridgeComplete, setBridgeComplete] = React.useState(false)
  const [walletConnected, setWalletConnected] = React.useState(false)
  const [account, setAccount] = React.useState('')
  const [hasAllowance, setHasAllowance] = React.useState(false)
  const tokenAddress = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" //  USDT on OPTIMISM 
  const tokenDecimal = 6

  const handleBridge = async (e) => {
    // ADD CODE
    e.preventDefault()
    if (!amount || !selectedToken) return

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = await provider.getSigner()
    const amountInWei = ethers.utils.parseUnits(amount, tokenDecimal) 
  
    if (!hasAllowance) {
      setApproving(true)
      try {
        const approvalTx = await approveToken(signer, tokenAddress, amountInWei)
        console.log("Approval transaction hash:", approvalTx)
        setHasAllowance(true)
      } catch (error) {
        console.error("Approval failed:", error)
      } finally {
        setApproving(false)
      }
    } else {
      setBridging(true)
      try {
        const txHash = await initiateBridgeDeposit(signer, tokenAddress, amountInWei)
        console.log("Bridge transaction hash:", txHash)
        setBridgeComplete(true)
      } catch (error) {
        console.error("Bridge failed:", error)
      } finally {
        setBridging(false)
      }
    }
  }

  const handleConnectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        const signer = provider.getSigner()
        const address = await signer.getAddress()
        setAccount(address)
        setWalletConnected(true)

        // Check allowance after connecting wallet
        const amountInWei = ethers.utils.parseUnits(amount || '0', tokenDecimal)
        const allowance = await checkAllowance(signer, tokenAddress, amountInWei)
        console.log("allowance ", ethers.utils.formatEther(allowance))
        setHasAllowance(allowance)
      } catch (error) {
        console.error('Error connecting to wallet:', error)
      }
    } else {
      console.log('Please install MetaMask!')
    }
  }

  React.useEffect(() => {
    const checkAllowanceEffect = async () => {
      if (walletConnected && amount) {
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        const signer = provider.getSigner()
        const amountInWei = ethers.utils.parseUnits(amount, tokenDecimal)
        const allowance = await checkAllowance(signer, tokenAddress, amountInWei)
        setHasAllowance(allowance)
      }
    }
    checkAllowanceEffect()
  }, [walletConnected, amount])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Yearn V3 Vault</CardTitle>
          <Button 
            variant="outline" 
            onClick={handleConnectWallet}
            disabled={walletConnected}
          >
            {walletConnected ? (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                {account.slice(0, 6)}...{account.slice(-4)}
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </>
            )}
          </Button>
        </div>
        <CardDescription>Bridge And deposit in Yearn V3 vault</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBridge} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Select Vault</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken} required>
              <SelectTrigger id="token">
                <SelectValue placeholder="Select Vault" />
              </SelectTrigger>
              <SelectContent>
                {tokenVaults.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={bridging || approving || bridgeComplete || !walletConnected || !amount || !selectedToken}
          >
            {bridging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bridging and depositing ...
              </>
            ) : approving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : !hasAllowance ? (
              <>
                Approve
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Bridge + Deposit
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        {bridgeComplete && (
          <p className="text-sm text-green-600 font-medium">
            Transaction complete!
          </p>
        )}
      </CardFooter>
    </Card>
  )
}

export default function BridgeAndDeposit() {
  return <BridgeAndDepositClient />
}
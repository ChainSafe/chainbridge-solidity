import { ERC20InitiateBridge, ERC20ProposalExecuted } from '../generated/Contract/ERC20Handler'
import { BridgeEvent } from '../generated/schema'

export function handleERC20InitiateBridge(event: ERC20InitiateBridge): void {
  const entity = new BridgeEvent(event.transaction.hash.toHex() + '-' + event.logIndex.toString())
  entity.address = event.params.recipientAddress
  entity.amount = event.params.amount
  entity.resourceId = event.params.resourceID
  entity.txHash = event.transaction.hash
  entity.timestamp = event.block.timestamp
  entity.direction = 'outbound'
  entity.status = 'pending'
  entity.save()
}

export function handleERC20ProposalExecuted(event: ERC20ProposalExecuted): void {
  const entity = new BridgeEvent(event.transaction.hash.toHex() + '-' + event.logIndex.toString())
  entity.address = event.params.recipientAddress
  entity.amount = event.params.amount
  entity.resourceId = event.params.resourceID
  entity.txHash = event.transaction.hash
  entity.timestamp = event.block.timestamp
  entity.direction = 'inbound'
  entity.status = 'success'
  entity.save()
}

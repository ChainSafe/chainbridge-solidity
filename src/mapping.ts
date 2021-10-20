import { ERC20ProposalExecuted } from '../generated/Contract/ERC20Handler'
import { BridgeEvent } from '../generated/schema'

export function handleERC20ProposalExecuted(event: ERC20ProposalExecuted): void {
  const entity = new BridgeEvent(event.transaction.hash.toHex() + '-' + event.logIndex.toString())
  entity.address = event.params.recipientAddress
  entity.amount = event.params.amount
  entity.resourceId = event.params.resourceID
  entity.txHash = event.transaction.hash
  entity.timestamp = Date.now()
  entity.save()
}

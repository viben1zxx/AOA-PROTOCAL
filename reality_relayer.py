"""Relayer script to bridge AOA Reality Trigger data into AOAEscrowVault settlement flow."""

import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3
from web3.middleware import geth_poa_middleware

load_dotenv()

RPC_URL = os.getenv('ALCHEMY_RPC_URL')
PRIVATE_KEY = os.getenv('PRIVATE_KEY')
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')
REALITY_ORACLE_ADDRESS = os.getenv('REALITY_ORACLE_ADDRESS')

if not RPC_URL:
    raise EnvironmentError('ALCHEMY_RPC_URL must be set in .env')
if not PRIVATE_KEY:
    raise EnvironmentError('PRIVATE_KEY must be set in .env')
if not CONTRACT_ADDRESS:
    raise EnvironmentError('CONTRACT_ADDRESS must be set in .env')

w3 = Web3(Web3.HTTPProvider(RPC_URL))
if w3.eth.chain_id in (5, 11155111, 1337, 31337):
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)

account = Account.from_key(PRIVATE_KEY)

CONTRACT_ABI = [
    {
        'name': 'submitRealityTrigger',
        'type': 'function',
        'stateMutability': 'nonpayable',
        'inputs': [
            {'name': '_dataHash', 'type': 'bytes32'},
            {'name': '_locationHash', 'type': 'bytes32'},
            {'name': '_region', 'type': 'uint8'},
            {'name': '_signature', 'type': 'bytes'},
        ],
        'outputs': [],
    },
    {
        'name': 'executeSettlement',
        'type': 'function',
        'stateMutability': 'nonpayable',
        'inputs': [
            {'name': '_triggerId', 'type': 'uint256'},
            {'name': '_settlementId', 'type': 'uint256'},
            {'name': '_beneficiary', 'type': 'address'},
            {'name': '_amount', 'type': 'uint256'},
            {'name': '_marketIdHash', 'type': 'bytes32'},
        ],
        'outputs': [],
    },
]

contract = w3.eth.contract(address=Web3.to_checksum_address(
    CONTRACT_ADDRESS), abi=CONTRACT_ABI)


@dataclass
class TriggerPayload:
    verification_hash: str
    location: str
    signature: str
    market_id: str
    timestamp: str
    is_physical: bool
    trigger_id: Optional[int] = None
    beneficiary: Optional[str] = None
    amount: Optional[int] = None
    settlement_id: Optional[int] = None


def load_payload(path: str) -> TriggerPayload:
    with open(path, 'r', encoding='utf-8') as fh:
        data = json.load(fh)
    return TriggerPayload(**data)


def ensure_hex32(value: str) -> bytes:
    hex_value = value.replace('0x', '')
    if len(hex_value) != 64:
        raise ValueError(
            'Expected 32-byte hex string for data hash or signature input')
    return bytes.fromhex(hex_value)


def build_transaction(tx_data: Dict[str, Any]) -> Dict[str, Any]:
    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = w3.eth.gas_price
    tx_data.update({
        'from': account.address,
        'nonce': nonce,
        'gasPrice': gas_price,
    })
    if 'gas' not in tx_data:
        tx_data['gas'] = 350_000
    return tx_data


def submit_reality_trigger(payload: TriggerPayload, region: int = 1) -> str:
    data_hash = ensure_hex32(payload.verification_hash)
    location_hash = Web3.keccak(text=payload.location)
    signature = bytes.fromhex(payload.signature.replace('0x', ''))

    tx = contract.functions.submitRealityTrigger(
        data_hash,
        location_hash,
        region,
        signature,
    ).build_transaction(build_transaction({}))

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    print(f'Submitted Reality Trigger: {tx_hash.hex()}')
    return tx_hash.hex()


def execute_settlement(payload: TriggerPayload) -> str:
    if payload.trigger_id is None or payload.settlement_id is None or payload.beneficiary is None or payload.amount is None:
        raise ValueError(
            'trigger_id, settlement_id, beneficiary, and amount are required for settlement execution')

    market_id_hash = Web3.keccak(text=payload.market_id)
    tx = contract.functions.executeSettlement(
        payload.trigger_id,
        payload.settlement_id,
        Web3.to_checksum_address(payload.beneficiary),
        payload.amount,
        market_id_hash,
    ).build_transaction(build_transaction({}))

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    print(f'Executed settlement: {tx_hash.hex()}')
    return tx_hash.hex()


def print_usage() -> None:
    print('Usage: python reality_relayer.py submit <payload.json> [region]')
    print('       python reality_relayer.py settle <payload.json>')
    print('payload.json should contain verification_hash, location, signature, market_id, timestamp, is_physical, and optionally trigger_id, settlement_id, beneficiary, amount')


def main() -> None:
    if len(sys.argv) < 3:
        print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()
    payload = load_payload(sys.argv[2])
    if command == 'submit':
        region = int(sys.argv[3]) if len(sys.argv) > 3 else 1
        submit_reality_trigger(payload, region=region)
    elif command == 'settle':
        execute_settlement(payload)
    else:
        print_usage()
        sys.exit(1)


if __name__ == '__main__':
    main()

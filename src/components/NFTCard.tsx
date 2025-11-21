'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { getContractWithSigner } from '@/lib/contract'
import { formatAddress } from '@/lib/web3'
import { Trash2 } from 'lucide-react' // ← 휴지통 아이콘 추가

// ⭐ IPFS URL 변환 함수
const convertIPFSUrl = (url: string): string => {
  if (!url) return url
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '')
    return `https://gateway.pinata.cloud/ipfs/${hash}`
  }
  return url
}

interface NFTMetadata {
  name?: string
  description?: string
  image?: string
  attributes?: any[]
}

interface NFTCardProps {
  tokenId: string
  owner: string
  tokenURI: string
  currentAddress: string
  onTransfer: () => void
  onRefresh: () => void
  onRemove: (tokenId: string) => void
}

export default function NFTCard({
  tokenId,
  owner,
  tokenURI,
  currentAddress,
  onTransfer,
  onRefresh,
  onRemove,
}: NFTCardProps) {
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)

  const [isApproving, setIsApproving] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [isBurning, setIsBurning] = useState(false)

  const [showTransfer, setShowTransfer] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [approveTo, setApproveTo] = useState('')

  const isOwner =
    currentAddress &&
    owner &&
    owner.toLowerCase() === currentAddress.toLowerCase()

  /* ------------------------------------------------------------------
     ⭐ 메타데이터 로딩
  ------------------------------------------------------------------ */
  useEffect(() => {
    const loadMetadata = async () => {
      if (!tokenURI) return

      try {
        setIsLoadingMetadata(true)

        let metadataUrl = tokenURI
        if (metadataUrl.startsWith('ipfs://')) {
          metadataUrl = convertIPFSUrl(metadataUrl)
        }

        const res = await fetch(metadataUrl)
        if (!res.ok) throw new Error('메타데이터 로드 실패')

        const data = await res.json()
        setMetadata(data)

        if (data.image) {
          setImageUrl(convertIPFSUrl(data.image))
        } else {
          setImageUrl(null)
        }
      } catch (err) {
        console.error('메타데이터 로드 오류:', err)
        setMetadata(null)
        setImageUrl(null)
      } finally {
        setIsLoadingMetadata(false)
      }
    }

    loadMetadata()
  }, [tokenURI])

  /* ------------------------------------------------------------------
     승인 기능
  ------------------------------------------------------------------ */
  const handleApprove = async () => {
    if (!approveTo || !ethers.isAddress(approveTo)) {
      alert('유효한 주소를 입력해주세요.')
      return
    }

    try {
      setIsApproving(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getContractWithSigner(signer)

      const tx = await contract.approve(approveTo, tokenId)
      await tx.wait()

      alert('승인 완료!')
      setShowApprove(false)
      onRefresh()
    } catch (err: any) {
      alert(err.message || '승인 실패')
    } finally {
      setIsApproving(false)
    }
  }

  /* ------------------------------------------------------------------
     전송 기능
  ------------------------------------------------------------------ */
  const handleTransfer = async () => {
    if (!transferTo || !ethers.isAddress(transferTo)) {
      alert('유효한 주소를 입력해주세요.')
      return
    }

    try {
      setIsTransferring(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getContractWithSigner(signer)

      const tx = await contract.safeTransferFrom(
        currentAddress,
        transferTo,
        tokenId
      )
      await tx.wait()

      alert('전송 완료!')
      setShowTransfer(false)
      onTransfer()
    } catch (err: any) {
      alert(err.message || '전송 실패')
    } finally {
      setIsTransferring(false)
    }
  }

  /* ------------------------------------------------------------------
     ⭐ 실제 삭제(burn)
  ------------------------------------------------------------------ */
  const handleBurn = async () => {
    if (!window.confirm(`Token ID ${tokenId} 를\n정말 삭제하시겠습니까?`))
      return

    try {
      setIsBurning(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = getContractWithSigner(signer)

      const tx = await contract.burn(tokenId)
      await tx.wait()

      alert(`Token ID ${tokenId} 삭제 완료!`)
      onRemove(tokenId)
    } catch (err: any) {
      console.error(err)
      alert(err.message || '삭제 실패!')
    } finally {
      setIsBurning(false)
    }
  }

  /* ------------------------------------------------------------------
     UI 렌더링
  ------------------------------------------------------------------ */
  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
      {/* 이미지 */}
      {isLoadingMetadata ? (
        <div className="w-full h-48 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-3 flex items-center justify-center">
          로딩 중...
        </div>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          className="w-full h-48 rounded-lg object-cover mb-3"
          alt="NFT"
        />
      ) : (
        <div className="w-full h-48 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-3 flex items-center justify-center">
          이미지 없음
        </div>
      )}

      {/* 텍스트 */}
      <h3 className="text-lg font-semibold">
        {metadata?.name || `Token ID: ${tokenId}`}
      </h3>

      {metadata?.description && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          {metadata.description}
        </p>
      )}

      <p className="text-sm mt-1">소유자: {formatAddress(owner)}</p>

      {/* 버튼 */}
      {isOwner && (
        <div className="mt-3 space-y-2">
          {!showTransfer && !showApprove && (
            <div className="flex gap-2">
              {/* 전송 */}
              <button
                className="flex-1 bg-blue-600 text-white py-2 rounded font-medium"
                onClick={() => {
                  setShowTransfer(true)
                  setShowApprove(false)
                }}
              >
                전송
              </button>

              {/* 승인 */}
              <button
                className="flex-1 bg-green-600 text-white py-2 rounded font-medium"
                onClick={() => {
                  setShowApprove(true)
                  setShowTransfer(false)
                }}
              >
                승인
              </button>

              {/* 삭제 (lucide-react 휴지통 아이콘 포함) */}
              <button
                className="flex-1 bg-red-600 text-white py-2 rounded font-medium flex items-center justify-center gap-1"
                onClick={handleBurn}
                disabled={isBurning}
              >
                <Trash2 size={18} />
                {isBurning ? '삭제 중…' : '삭제'}
              </button>
            </div>
          )}

          {/* 전송 UI */}
          {showTransfer && (
            <div className="space-y-2">
              <input
                className="w-full px-3 py-2 border rounded"
                placeholder="받을 주소"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
              />
              <button
                className="w-full bg-blue-600 text-white py-2 rounded"
                disabled={isTransferring}
                onClick={handleTransfer}
              >
                {isTransferring ? '전송 중...' : '전송하기'}
              </button>
              <button
                className="w-full bg-zinc-400 py-2 rounded"
                onClick={() => {
                  setShowTransfer(false)
                  setTransferTo('')
                }}
              >
                취소
              </button>
            </div>
          )}

          {/* 승인 UI */}
          {showApprove && (
            <div className="space-y-2">
              <input
                className="w-full px-3 py-2 border rounded"
                placeholder="승인할 주소"
                value={approveTo}
                onChange={(e) => setApproveTo(e.target.value)}
              />
              <button
                className="w-full bg-green-600 text-white py-2 rounded"
                disabled={isApproving}
                onClick={handleApprove}
              >
                {isApproving ? '승인 중...' : '승인하기'}
              </button>
              <button
                className="w-full bg-zinc-400 py-2 rounded"
                onClick={() => {
                  setShowApprove(false)
                  setApproveTo('')
                }}
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

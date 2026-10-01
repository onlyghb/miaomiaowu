import { Component, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Very long node URIs can exceed QR capacity. Keep the URI available to copy.
class NodeQrCode extends Component<{ uri: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <p role='alert' className='text-destructive text-center text-sm'>
          节点 URI 过长或无法生成二维码，请复制下方 URI 导入客户端。
        </p>
      )
    }

    return (
      <div className='max-w-full rounded-xl border bg-white p-3'>
        <QRCodeSVG
          value={this.props.uri}
          size={256}
          level='M'
          marginSize={4}
          title='节点 URI 二维码'
          className='h-auto max-w-full'
        />
      </div>
    )
  }
}

export function NodeQrCodeDialog({
  node,
  onClose,
}: {
  node: { name: string; uri: string } | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={Boolean(node)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className='max-h-[85dvh] overflow-y-auto sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>节点二维码</DialogTitle>
          <DialogDescription>
            使用代理客户端扫描二维码，导入当前节点。
          </DialogDescription>
        </DialogHeader>
        {node && (
          <div className='flex min-w-0 flex-col items-center gap-4'>
            <p className='max-w-full text-center text-sm font-medium break-all'>
              {node.name}
            </p>
            <NodeQrCode key={node.uri} uri={node.uri} />
            <div className='bg-muted max-h-32 w-full overflow-y-auto rounded-md p-3'>
              <code className='text-xs break-all select-all'>{node.uri}</code>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

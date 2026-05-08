'use client'

import * as React from 'react'
import { Popover } from '@base-ui/react/popover'

import { cn } from '@/lib/utils'

type PopoverRootProps = React.ComponentProps<typeof Popover.Root>
type PopoverTriggerProps = React.ComponentProps<typeof Popover.Trigger>
type PopoverPortalProps = React.ComponentProps<typeof Popover.Portal>
type PopoverPositionerProps = React.ComponentProps<typeof Popover.Positioner>
type PopoverContentProps = React.ComponentProps<typeof Popover.Popup>

function PopoverRoot({ ...props }: PopoverRootProps) {
  return <Popover.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ children, ...props }: PopoverTriggerProps) {
  return (
    <Popover.Trigger data-slot="popover-trigger" {...props}>
      {children}
    </Popover.Trigger>
  )
}

function PopoverPortal({ ...props }: PopoverPortalProps) {
  return <Popover.Portal data-slot="popover-portal" {...props} />
}

function PopoverPositioner({
  align = 'start',
  side = 'bottom',
  sideOffset = 4,
  className,
  ...props
}: PopoverPositionerProps) {
  return (
    <Popover.Positioner
      data-slot="popover-positioner"
      align={align}
      side={side}
      sideOffset={sideOffset}
      className={cn('z-50 outline-none', className)}
      {...props}
    />
  )
}

function PopoverContent({ className, children, ...props }: PopoverContentProps) {
  return (
    <Popover.Popup
      data-slot="popover-content"
      className={cn(
        'z-50 origin-(--transform-origin) rounded-sm border border-border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        'data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
        'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
        className
      )}
      {...props}
    >
      {children}
    </Popover.Popup>
  )
}

export {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverContent,
}

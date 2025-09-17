import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { motion } from "framer-motion"
import { cn, getInitials, getAvatarColor } from "../../lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  </motion.div>
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & {
    name?: string
  }
>(({ className, name, children, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground",
      name && getAvatarColor(name),
      name && "text-white",
      className
    )}
    {...props}
  >
    {children || (name ? getInitials(name) : null)}
  </AvatarPrimitive.Fallback>
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

// Premium Avatar with status indicator
interface PremiumAvatarProps extends React.ComponentPropsWithoutRef<typeof Avatar> {
  name: string
  src?: string
  status?: 'online' | 'offline' | 'away' | 'busy'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const PremiumAvatar = React.forwardRef<
  React.ElementRef<typeof Avatar>,
  PremiumAvatarProps
>(({ name, src, status, size = 'md', className, ...props }, ref) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  }

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500'
  }

  return (
    <div className="relative">
      <Avatar
        ref={ref}
        className={cn(sizeClasses[size], className)}
        {...props}
      >
        <AvatarImage src={src} alt={name} />
        <AvatarFallback name={name} />
      </Avatar>
      {status && (
        <motion.div
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
            statusColors[status]
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
        />
      )}
    </div>
  )
})
PremiumAvatar.displayName = "PremiumAvatar"

export { Avatar, AvatarImage, AvatarFallback, PremiumAvatar }

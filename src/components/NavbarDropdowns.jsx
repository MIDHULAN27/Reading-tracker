import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Inbox, Check, Trash, Award, Bookmark, Sparkles, Bell, User, Database, LogOut
} from 'lucide-react';

const dropdownTransition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1], // Premium ease-out
};

export const NotificationDropdown = React.memo(function NotificationDropdown({
  notifications,
  unreadCount,
  markAllNotificationsAsRead,
  toggleReadNotification,
  deleteNotification,
}) {
  return (
    <motion.div
      role="dialog"
      aria-label="Notifications center panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={dropdownTransition}
      style={{ willChange: 'transform, opacity' }}
      className="absolute right-0 mt-3 w-80 sm:w-96 glass-overlay rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)] z-[100] space-y-4 transform-gpu pointer-events-auto"
    >
      <div className="flex items-center justify-between border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 pb-3">
        <div className="flex items-center gap-1.5">
          <Inbox className="w-4 h-4 text-booklyn-amber" />
          <h4 className="font-serif text-sm font-bold text-booklyn-night-300 dark:text-booklyn-cream-50">Notifications Center</h4>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllNotificationsAsRead}
            className="text-[10px] font-bold text-booklyn-amber dark:text-booklyn-amber-light hover:underline flex items-center gap-1 focus-visible:outline-none cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-8 text-center text-booklyn-night-100/40 dark:text-booklyn-cream-200/35 italic flex flex-col items-center gap-2">
          <Bell className="w-8 h-8 text-booklyn-night-100/20" />
          <p className="text-xs">All caught up! No notifications.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {notifications.map(notif => (
            <div 
              key={notif.id}
              className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 text-xs ${
                notif.read 
                  ? 'bg-white/10 dark:bg-black/10 border-white/5 opacity-75 text-booklyn-night-100/60 dark:text-booklyn-cream-200/50' 
                  : 'bg-gradient-to-tr from-booklyn-amber/5 to-booklyn-lavender/5 border-booklyn-amber/20 shadow-sm shadow-booklyn-amber/5 text-booklyn-night-300 dark:text-booklyn-cream-50'
              }`}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className="mt-0.5 flex-shrink-0">
                  {notif.type === 'streak' && <Award className="w-4 h-4 text-booklyn-amber" />}
                  {notif.type === 'book' && <Bookmark className="w-4 h-4 text-booklyn-lavender" />}
                  {notif.type === 'recommend' && <Sparkles className="w-4 h-4 text-booklyn-amber" />}
                </div>
                <div className="space-y-1">
                  <p className="leading-relaxed font-semibold">{notif.text}</p>
                  <span className="text-[9px] text-booklyn-night-100/45 dark:text-booklyn-cream-200/40 font-medium">{notif.time}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button 
                  onClick={() => toggleReadNotification(notif.id)}
                  title={notif.read ? "Mark as unread" : "Mark as read"}
                  className={`p-1 rounded hover:bg-white/20 dark:hover:bg-white/10 transition-colors cursor-pointer ${notif.read ? 'text-booklyn-night-100/40' : 'text-booklyn-amber'}`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => deleteNotification(notif.id)}
                  title="Dismiss notification"
                  className="p-1 rounded hover:bg-red-500/10 text-booklyn-night-100/30 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
});

export const ProfileDropdown = React.memo(function ProfileDropdown({
  user,
  initials,
  handleSignOut,
  onClose,
}) {
  return (
    <motion.div
      role="menu"
      aria-label="User profile menu options"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={dropdownTransition}
      style={{ willChange: 'transform, opacity' }}
      className="absolute right-0 mt-3 w-64 glass-overlay rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)] z-[100] space-y-4 transform-gpu pointer-events-auto"
    >
      <div className="flex items-center gap-3 border-b border-booklyn-cream-300/40 dark:border-booklyn-night-100/10 pb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-booklyn-amber to-booklyn-lavender text-white flex items-center justify-center text-base font-bold border border-white/20 shadow-md">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-serif font-bold text-sm truncate text-booklyn-night-300 dark:text-booklyn-cream-50">
            {user?.user_metadata?.full_name || 'Booklyn'}
          </p>
          <p className="text-[10px] text-booklyn-night-100/50 dark:text-booklyn-cream-200/40 truncate mt-0.5">
            {user?.email || 'Guest Reader'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 text-xs font-semibold">
        <Link 
          to="/reading-profile"
          onClick={onClose}
          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/25 dark:hover:bg-white/5 transition-all text-booklyn-night-100/80 dark:text-booklyn-cream-200/80 hover:text-booklyn-night-100 dark:hover:text-white"
        >
          <User className="w-4 h-4 text-booklyn-amber" />
          <span>My Profile & Streaks</span>
        </Link>
        <Link 
          to="/settings"
          onClick={onClose}
          className="flex items-center justify-between p-2 rounded-xl hover:bg-white/25 dark:hover:bg-white/5 transition-all text-booklyn-night-100/80 dark:text-booklyn-cream-200/80 hover:text-booklyn-night-100 dark:hover:text-white"
        >
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-booklyn-lavender" />
            <span>DB Connection</span>
          </div>
          <div className="px-2 py-0.5 rounded-lg bg-white/10 dark:bg-black/10 border border-white/15 text-[8px] uppercase tracking-wider font-bold">
            Supabase
          </div>
        </Link>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 active:scale-95 transition-all text-xs font-bold cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>
    </motion.div>
  );
});

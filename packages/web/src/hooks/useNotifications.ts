import { useEffect, useState, useCallback, useRef } from 'react';
import {
  requestNotificationPermission,
  showNotification,
  updatePageTitleBadge,
  isPageVisible,
  playAudioAlert,
} from '../utils/notifications';

interface UseNotificationsOptions {
  autoRequestPermission?: boolean;
  enableAudio?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { autoRequestPermission = false, enableAudio = false } = options;
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const hasRequestedPermission = useRef(false);

  // Request permission on mount if autoRequestPermission is true
  useEffect(() => {
    if (autoRequestPermission && !hasRequestedPermission.current) {
      requestPermission();
    }
  }, [autoRequestPermission]);

  // Update page title when pending count changes
  useEffect(() => {
    updatePageTitleBadge(pendingCount);
  }, [pendingCount]);

  const requestPermission = useCallback(async () => {
    if (hasRequestedPermission.current) {
      return permissionGranted;
    }

    hasRequestedPermission.current = true;
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    return granted;
  }, [permissionGranted]);

  const notify = useCallback(
    (title: string, body: string, options: { url?: string; tag?: string; audio?: boolean } = {}) => {
      // Play audio if enabled and requested
      if (enableAudio && options.audio) {
        playAudioAlert('info');
      }

      // Show notification if tab is not focused
      if (!isPageVisible()) {
        showNotification(title, {
          body,
          tag: options.tag,
          data: { url: options.url },
        });
      }
    },
    [enableAudio]
  );

  const notifyApprovalRequired = useCallback(
    (executionId: string, agentId: string, tool: string) => {
      if (enableAudio) {
        playAudioAlert('warning');
      }

      notify('Approval Required', `${agentId} wants to execute ${tool}`, {
        url: '/approvals',
        tag: 'approval',
        audio: true,
      });

      setPendingCount((prev) => prev + 1);
    },
    [notify, enableAudio]
  );

  const notifyExecutionBlocked = useCallback(
    (executionId: string, agentId: string, tool: string, reason: string) => {
      if (enableAudio) {
        playAudioAlert('error');
      }

      notify('Execution Blocked', `${agentId}: ${tool} - ${reason}`, {
        url: '/executions',
        tag: 'blocked',
        audio: true,
      });
    },
    [notify, enableAudio]
  );

  const notifyBreakerActivated = useCallback(
    (scope: string, target: string) => {
      if (enableAudio) {
        playAudioAlert('error');
      }

      notify('Emergency Stop Activated', `${scope} breaker activated for ${target}`, {
        url: '/breakers',
        tag: 'breaker',
        audio: true,
      });
    },
    [notify, enableAudio]
  );

  const notifyApprovalResolved = useCallback(
    (decision: string) => {
      notify('Approval Resolved', `Execution ${decision.toLowerCase()}`, {
        url: '/executions',
        tag: 'approval-resolved',
      });

      setPendingCount((prev) => Math.max(0, prev - 1));
    },
    [notify]
  );

  const notifyRollbackInitiated = useCallback(
    (rollbackId: string) => {
      notify('Rollback Initiated', 'Execution rollback has been started', {
        url: `/rollbacks/${rollbackId}`,
        tag: 'rollback',
      });
    },
    [notify]
  );

  const updatePendingCount = useCallback((count: number) => {
    setPendingCount(count);
  }, []);

  return {
    permissionGranted,
    pendingCount,
    requestPermission,
    notify,
    notifyApprovalRequired,
    notifyExecutionBlocked,
    notifyBreakerActivated,
    notifyApprovalResolved,
    notifyRollbackInitiated,
    updatePendingCount,
  };
}

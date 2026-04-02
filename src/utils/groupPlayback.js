// ─── GROUP PLAYBACK CONTROLLER ──────────────────────────────
// Manages playback sequencing for track groups.
// Handles random, sequential, and custom loop modes.
//
// Loop groups: current sub-track loops continuously.
//   Trigger/advance → stops current, starts next sub-track looping.
// Trigger groups: each trigger plays the next sub-track as a one-shot.

export class GroupPlaybackController {
  constructor(audioEngine) {
    this.engine = audioEngine;
    this.activeSubTrack = {}; // groupId → currently playing subTrack id
    this.autoTimers = {};     // groupId → timeout id
    this.onGroupUpdate = null; // callback to update group state
    this.getLatestGroup = null; // callback to get latest group state
  }

  // Get the next sub-track index based on play mode
  getNextIndex(group) {
    const seq = group.customSequence || [];
    // Fall back to sequential if custom sequence is empty
    const useCustom = group.playMode === 'custom' && seq.length > 0;

    if (group.subTracks.length === 0) return 0;

    switch (useCustom ? 'custom' : (group.playMode === 'custom' ? 'sequential' : group.playMode)) {
      case 'random':
        return Math.floor(Math.random() * group.subTracks.length);
      case 'sequential':
        return ((group.currentIndex ?? -1) + 1) % group.subTracks.length;
      case 'custom':
        return ((group.currentIndex ?? -1) + 1) % seq.length;
      default:
        return ((group.currentIndex ?? -1) + 1) % group.subTracks.length;
    }
  }

  // Resolve which sub-track to play at a given index
  resolveSubTrack(group, index) {
    const seq = group.customSequence || [];
    if (group.playMode === 'custom' && seq.length > 0) {
      const subIdx = seq[index];
      return group.subTracks[subIdx] ?? group.subTracks[0];
    }
    return group.subTracks[index] ?? group.subTracks[0];
  }

  // Get the auto-advance delay for a group (ms)
  getAutoDelay(group) {
    if (!group.autoAdvance) return null;
    if (group.autoAdvanceRandom) {
      const min = group.autoAdvanceMin ?? 5000;
      const max = group.autoAdvanceMax ?? 15000;
      return min + Math.random() * (max - min);
    }
    return group.autoAdvanceInterval ?? 10000;
  }

  // Schedule the next auto-advance
  scheduleAutoAdvance(group) {
    this.clearAutoTimer(group.id);
    if (!group.autoAdvance) return;

    const delay = this.getAutoDelay(group);
    if (delay == null) return;

    this.autoTimers[group.id] = setTimeout(() => {
      try {
        const latest = this.getLatestGroup?.(group.id);
        if (!latest || !latest.playing || !latest.autoAdvance) return;
        this.advanceGroup(latest);
      } catch (err) {
        console.error('[Group] Auto-advance error:', err);
      }
    }, delay);
  }

  clearAutoTimer(groupId) {
    if (this.autoTimers[groupId]) {
      clearTimeout(this.autoTimers[groupId]);
      delete this.autoTimers[groupId];
    }
  }

  // Play a sub-track once (no loop). Timer is started by caller.
  playSub(group, sub) {
    const vol = (group.volume / 100) * (sub.volume / 100);
    this.engine.setLayerVolume(sub.id, group.muted ? 0 : vol);
    this.engine.setLayerSpeed(sub.id, (sub.speed ?? 100) / 100);
    this.activeSubTrack[group.id] = sub.id;
    this.engine.playLayerOnce(sub.id);
  }

  // Start a loop group — plays the current sub-track (doesn't advance).
  startGroup(group) {
    if (!group.subTracks.length) return;

    // Play current track, or first if none set
    const idx = group.currentIndex ?? 0;
    const sub = this.resolveSubTrack(group, idx);
    if (!sub?.loaded) return;

    this.stopGroup(group);
    this.playSub(group, sub);

    if (this.onGroupUpdate) {
      this.onGroupUpdate(group.id, { currentIndex: idx });
    }

    // Start timer — when it fires, stop this track and play next
    this.scheduleAutoAdvance(group);
  }

  // Advance to next sub-track (manual or auto)
  advanceGroup(group) {
    if (!group.subTracks.length) return;

    const nextIdx = this.getNextIndex(group);
    const sub = this.resolveSubTrack(group, nextIdx);
    if (!sub?.loaded) return;

    // Stop current track
    const activeId = this.activeSubTrack[group.id];
    if (activeId) this.engine.stopLayer(activeId);

    this.playSub(group, sub);

    if (this.onGroupUpdate) {
      this.onGroupUpdate(group.id, { currentIndex: nextIdx });
    }

    // Restart timer for the next advance
    const latest = this.getLatestGroup?.(group.id);
    this.scheduleAutoAdvance(latest || group);
  }

  // Stop a group
  stopGroup(group) {
    this.clearAutoTimer(group.id);
    const activeId = this.activeSubTrack[group.id];
    if (activeId) {
      this.engine.stopLayer(activeId);
      delete this.activeSubTrack[group.id];
    }
    for (const sub of group.subTracks) {
      this.engine.stopLayer(sub.id);
    }
  }

  // Trigger a group (for trigger-type groups) — play next as one-shot
  triggerGroup(group) {
    if (!group.subTracks.length) return;

    const nextIdx = this.getNextIndex(group);
    const sub = this.resolveSubTrack(group, nextIdx);
    if (!sub?.loaded) return;

    const vol = (group.volume / 100) * (sub.volume / 100);
    this.engine.playSfx(sub.id, vol);

    if (this.onGroupUpdate) {
      this.onGroupUpdate(group.id, { currentIndex: nextIdx });
    }
  }

  getActiveSubTrackId(groupId) {
    return this.activeSubTrack[groupId] || null;
  }
}

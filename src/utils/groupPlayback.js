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
    this.onGroupUpdate = null; // callback to update group state
  }

  // Get the next sub-track index based on play mode
  getNextIndex(group) {
    const len = group.playMode === 'custom'
      ? group.customSequence.length
      : group.subTracks.length;

    if (len === 0) return 0;

    switch (group.playMode) {
      case 'random':
        return Math.floor(Math.random() * group.subTracks.length);
      case 'sequential':
        return ((group.currentIndex ?? -1) + 1) % group.subTracks.length;
      case 'custom':
        return ((group.currentIndex ?? -1) + 1) % group.customSequence.length;
      default:
        return 0;
    }
  }

  // Resolve which sub-track to play at a given index
  resolveSubTrack(group, index) {
    if (group.playMode === 'custom') {
      const subIdx = group.customSequence[index];
      return group.subTracks[subIdx] ?? group.subTracks[0];
    }
    return group.subTracks[index] ?? group.subTracks[0];
  }

  // Start a loop group — plays the current sub-track on loop.
  // Call advanceGroup() to switch to the next sub-track.
  startGroup(group) {
    if (!group.subTracks.length) return;

    const nextIdx = this.getNextIndex(group);
    const sub = this.resolveSubTrack(group, nextIdx);
    if (!sub?.loaded) return;

    // Stop any currently playing sub-track in this group
    this.stopGroup(group);

    // Set effective volume and speed
    const vol = (group.volume / 100) * (sub.volume / 100);
    this.engine.setLayerVolume(sub.id, group.muted ? 0 : vol);
    this.engine.setLayerSpeed(sub.id, (sub.speed ?? 100) / 100);

    // Play on loop — stays on this sub-track until advanced
    this.activeSubTrack[group.id] = sub.id;
    this.engine.playLayer(sub.id);

    if (this.onGroupUpdate) {
      this.onGroupUpdate(group.id, { currentIndex: nextIdx });
    }
  }

  // Advance to next sub-track in a loop group (triggered by user/event)
  advanceGroup(group) {
    if (!group.subTracks.length) return;

    const nextIdx = this.getNextIndex(group);
    const sub = this.resolveSubTrack(group, nextIdx);
    if (!sub?.loaded) return;

    // Stop current sub-track
    const activeId = this.activeSubTrack[group.id];
    if (activeId) this.engine.stopLayer(activeId);

    // Start next on loop
    const vol = (group.volume / 100) * (sub.volume / 100);
    this.engine.setLayerVolume(sub.id, group.muted ? 0 : vol);
    this.engine.setLayerSpeed(sub.id, (sub.speed ?? 100) / 100);
    this.activeSubTrack[group.id] = sub.id;
    this.engine.playLayer(sub.id);

    if (this.onGroupUpdate) {
      this.onGroupUpdate(group.id, { currentIndex: nextIdx });
    }
  }

  // Stop a group
  stopGroup(group) {
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

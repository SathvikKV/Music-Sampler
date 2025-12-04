export class DwellTimer {
  private startTime: number | null = null
  private pausedTime = 0
  private isPaused = false

  start(): void {
    if (this.startTime === null) {
      this.startTime = Date.now()
      this.isPaused = false
    }
  }

  pause(): void {
    if (!this.isPaused && this.startTime !== null) {
      this.pausedTime += Date.now() - this.startTime
      this.isPaused = true
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.startTime = Date.now()
      this.isPaused = false
    }
  }

  getDwellMs(): number {
    if (this.startTime === null) return 0
    if (this.isPaused) return this.pausedTime
    return this.pausedTime + (Date.now() - this.startTime)
  }

  reset(): void {
    this.startTime = null
    this.pausedTime = 0
    this.isPaused = false
  }
}

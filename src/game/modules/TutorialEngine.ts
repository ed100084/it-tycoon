import type { GameConfig, GameDate, IEventBus, IGameModule } from '../core/types';

export type TutorialStepId =
  | 'welcome'
  | 'buy_server'
  | 'hire_staff'
  | 'sign_contract'
  | 'start_time';

export interface TutorialStep {
  id: TutorialStepId;
  index: number;
  title: string;
  message: string;
  targetTab?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    index: 0,
    title: '歡迎加入 IT-Tycoon！',
    message:
      '你剛獲得天使投資 NT$500 萬，讓我們開始建設你的機房。\n點擊「機房」標籤來查看你的數據中心設施。',
    targetTab: 'facility',
  },
  {
    id: 'buy_server',
    index: 1,
    title: '採購第一台伺服器',
    message: '先購買你的第一台伺服器，讓機房開始產生收入！選擇一款合適的型號並點擊確認採購。',
    targetTab: 'hardware',
  },
  {
    id: 'hire_staff',
    index: 2,
    title: '招聘 NOC 監控員',
    message:
      '招聘一位 NOC 監控員來維運你的機房。進入人員管理，建立職缺後等待應徵者，再雇用他們。',
    targetTab: 'staff',
  },
  {
    id: 'sign_contract',
    index: 3,
    title: '接第一個客戶合約',
    message:
      '現在可以開始接客戶合約了！進入合約管理查看 RFP 標案，提交報價並等待客戶決定。',
    targetTab: 'contract',
  },
  {
    id: 'start_time',
    index: 4,
    title: '開始運營！',
    message:
      '太好了！你的機房已經開始運作。\n按下頂部的播放按鈕（▶）推進時間，讓業務開始成長吧！',
    targetTab: undefined,
  },
];

interface TutorialEngineState {
  completed: boolean;
  currentStep: number;
  everStarted: boolean;
}

export class TutorialEngine implements IGameModule {
  readonly moduleId = 'TutorialEngine';

  private bus!: IEventBus;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: TutorialEngineState = {
    completed: false,
    currentStep: 0,
    everStarted: false,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
    });
  }

  tick(_deltaMs: number): void {}

  /** Start the tutorial if it hasn't been started or completed. */
  start(): void {
    if (this.state.completed || this.state.everStarted) return;
    this.state.everStarted = true;
    this._emitCurrentStep();
  }

  /** Advance to the next tutorial step. */
  nextStep(): void {
    if (this.state.completed) return;
    this.state.currentStep++;
    if (this.state.currentStep >= TUTORIAL_STEPS.length) {
      this._complete();
    } else {
      this._emitCurrentStep();
    }
  }

  /** Skip the tutorial entirely. */
  skip(): void {
    if (this.state.completed) return;
    this._complete();
  }

  getCurrentStep(): TutorialStep | null {
    if (this.state.completed || !this.state.everStarted) return null;
    return TUTORIAL_STEPS[this.state.currentStep] ?? null;
  }

  isCompleted(): boolean {
    return this.state.completed;
  }

  hasStarted(): boolean {
    return this.state.everStarted;
  }

  private _emitCurrentStep(): void {
    const step = TUTORIAL_STEPS[this.state.currentStep];
    if (!step) return;
    this.bus.publish({
      type: 'tutorial.step_triggered',
      payload: { step },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private _complete(): void {
    this.state.completed = true;
    this.bus.publish({
      type: 'tutorial.completed',
      payload: {},
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  serialize(): Record<string, unknown> {
    return { ...this.state };
  }

  deserialize(state: Record<string, unknown>): void {
    if (typeof state.completed === 'boolean') this.state.completed = state.completed;
    if (typeof state.currentStep === 'number') this.state.currentStep = state.currentStep;
    if (typeof state.everStarted === 'boolean') this.state.everStarted = state.everStarted;
  }

  getState(): Readonly<Record<string, unknown>> {
    return { ...this.state };
  }

  destroy(): void {}
}

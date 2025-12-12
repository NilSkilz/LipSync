import { useSession } from '../context/SessionContext';

export function TimerControl() {
  const { state, actions } = useSession();
  const { timerSeconds } = state;

  const handleMinus = () => {
    actions.setTimer(Math.max(1, timerSeconds - 1));
  };

  const handlePlus = () => {
    actions.setTimer(Math.min(30, timerSeconds + 1));
  };

  return (
    <div className="timer-control">
      <button className="timer-btn" onClick={handleMinus}>
        -
      </button>
      <span className="timer-value">{timerSeconds} seconds</span>
      <button className="timer-btn" onClick={handlePlus}>
        +
      </button>
    </div>
  );
}

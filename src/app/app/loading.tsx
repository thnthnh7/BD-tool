import classes from "./loading.module.css";

export default function AppLoading() {
  return (
    <div className={classes.stack} aria-label="Đang tải nội dung" aria-live="polite">
      <div className={classes.heading}>
        <span className={classes.title} />
        <span className={classes.subtitle} />
      </div>
      <div className={classes.panel}>
        <div className={classes.row}>
          <span className={classes.identity} />
          <span className={classes.action} />
        </div>
        <span className={classes.progress} />
      </div>
      <div className={classes.panel}>
        <span className={classes.input} />
        <span className={classes.item} />
        <span className={classes.item} />
        <span className={classes.item} />
      </div>
    </div>
  );
}

import Phaser from "phaser";
import { PreviewScene } from "./scenes/PreviewScene";

/* @entry */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#1a1a2e",
  parent: document.body,
  scene: [PreviewScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTer_BOTHS,
  },
};

new Phaser.Game(config);

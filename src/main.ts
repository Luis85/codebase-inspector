import { Plugin } from 'obsidian';
import './ui/styles.css';

export default class CodebaseInspectorPlugin extends Plugin {
  override onload(): void {
    // Task 3 registers the view, the ribbon and the open-city command here.
    // onload REGISTERS ONLY: no scanning, no expensive work (spec 4.4).
  }
}

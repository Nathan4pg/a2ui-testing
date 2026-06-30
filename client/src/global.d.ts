// Ambient declarations so the type-checker accepts non-code imports that
// webpack handles via loaders (style-loader / asset modules).
declare module '*.css';
declare module '*.scss';
declare module '*.sass';

declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '*.png' {
  const content: string;
  export default content;
}
declare module '*.jpg' {
  const content: string;
  export default content;
}
declare module '*.jpeg' {
  const content: string;
  export default content;
}
declare module '*.gif' {
  const content: string;
  export default content;
}

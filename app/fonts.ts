import localFont from "next/font/local";

export const archivo = localFont({
  src: "./fonts/Archivo-Variable.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});

export const bigShoulders = localFont({
  src: "./fonts/BigShouldersDisplay-Variable.woff2",
  variable: "--font-big-shoulders",
  weight: "100 900",
  display: "swap",
});

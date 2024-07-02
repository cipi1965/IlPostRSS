import {fetch} from "node-fetch-cookies";

export default async function login(cookieJar, username, password) {
    const body = new URLSearchParams({
        log: username,
        pwd: password,
        'wp-submit': 'Accedi',
        'testcookie': 1,
    })

    const login = await fetch(cookieJar,"https://www.ilpost.it/wp-login.php", {
        body: body.toString(),
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
        }
    })

    return login.ok
}
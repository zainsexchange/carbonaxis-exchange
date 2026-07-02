function validatePassword(password){

    return{

        length: password.length >= 8,

        upper: /[A-Z]/.test(password),

        lower: /[a-z]/.test(password),

        number: /\d/.test(password),

        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)

    };

}
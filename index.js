"use strict";

const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const mime = require("mime");
const s3folder = require("./s3folder.js");

// Create an instance of the S3Folder component
let folder = new s3folder.S3Folder("s3-website-bucket", "./public");

// Export output property of `folder` as a stack output
exports.bucketName = folder.bucketName;

// Create a bucket and expose a website index document
let siteBucket = new aws.s3.Bucket("s3-website-bucket", {
    website: {
        indexDocument: "index.html",
    },
});

let siteDir = "www/public"; // directory for content files

// For each file in the directory, create an S3 object stored in `siteBucket`
for (let item of require("fs").readdirSync(siteDir)) {
    let filePath = require("path").join(siteDir, item);
    let object = new aws.s3.BucketObject(item, {
        bucket: siteBucket,                               // reference the s3.Bucket object
        source: new pulumi.asset.FileAsset(filePath),     // use FileAsset to point to a file
        contentType: mime.getType(filePath) || undefined, // set the MIME type of the file
    });
}

// Create an S3 Bucket Policy to allow public read of all objects in bucket
function publicReadPolicyForBucket(bucketName) {
    return {
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: "*",
            Action: [
                "s3:GetObject"
            ],
            Resource: [
                `arn:aws:s3:::${bucketName}/*` // policy refers to bucket name explicitly
            ]
        }]
    };
}
//createCloudfront
const s3OriginId = "myS3Origin";
const s3Distribution = new aws.cloudfront.Distribution("s3Distribution", {
    origins: [{
        domainName: bucket.bucketRegionalDomainName,
        originId: s3OriginId,
        s3OriginConfig: {
            originAccessIdentity: "origin-access-identity/cloudfront/ABCDEFG1234567",
        },
    }],
    enabled: true,
    isIpv6Enabled: true,
    comment: "Some comment",
    defaultRootObject: "index.html",
    loggingConfig: {
        includeCookies: false,
        bucket: "mylogs.s3.amazonaws.com",
        prefix: "myprefix",
    },
    aliases: [
        "mysite.example.com",
        "yoursite.example.com",
    ],
    defaultCacheBehavior: {
        allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
        ],
        cachedMethods: [
            "GET",
            "HEAD",
        ],
        targetOriginId: s3OriginId,
        forwardedValues: {
            queryString: false,
            cookies: {
                forward: "none",
            },
        },
        viewerProtocolPolicy: "allow-all",
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    orderedCacheBehaviors: [
        {
            pathPattern: "/content/immutable/*",
            allowedMethods: [
                "GET",
                "HEAD",
                "OPTIONS",
            ],
            cachedMethods: [
                "GET",
                "HEAD",
                "OPTIONS",
            ],
            targetOriginId: s3OriginId,
            forwardedValues: {
                queryString: false,
                headers: ["Origin"],
                cookies: {
                    forward: "none",
                },
            },
            minTtl: 0,
            defaultTtl: 86400,
            maxTtl: 31536000,
            compress: true,
            viewerProtocolPolicy: "redirect-to-https",
        },
        {
            pathPattern: "/content/*",
            allowedMethods: [
                "GET",
                "HEAD",
                "OPTIONS",
            ],
            cachedMethods: [
                "GET",
                "HEAD",
            ],
            targetOriginId: s3OriginId,
            forwardedValues: {
                queryString: false,
                cookies: {
                    forward: "none",
                },
            },
            minTtl: 0,
            defaultTtl: 3600,
            maxTtl: 86400,
            compress: true,
            viewerProtocolPolicy: "redirect-to-https",
        },
    ],
    priceClass: "PriceClass_200",
    restrictions: {
        geoRestriction: {
            restrictionType: "whitelist",
            locations: [
                "US",
                "CA",
                "GB",
                "DE",
            ],
        },
    },
    tags: {
        Environment: "production",
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
});

// Set the access policy for the bucket so all objects are readable
let bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: siteBucket.bucket, // refer to the bucket created earlier
    policy: siteBucket.bucket.apply(publicReadPolicyForBucket) // use output property `siteBucket.bucket`
});

// Stack exports
exports.bucketName = siteBucket.bucket;
exports.websiteUrl = siteBucket.websiteEndpoint;


